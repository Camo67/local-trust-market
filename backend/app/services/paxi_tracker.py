"""
Paxi logistics tracker with API and fallback scraping support.
Polls Paxi tracking endpoint and updates order states automatically.
"""
import httpx
from bs4 import BeautifulSoup
import json
from typing import Optional, Dict, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.escrow import Order, EscrowStatus
from app.services.ledger_service import transition_order_state, InvalidStateTransition


class PaxiTrackingError(Exception):
    """Raised when Paxi tracking fails."""
    pass


def poll_paxi_api(waybill_number: str, api_key: Optional[str] = None) -> Dict:
    """
    Poll official Paxi API if available.
    
    Args:
        waybill_number: The Paxi waybill/tracking number
        api_key: Optional API key for authenticated requests
        
    Returns:
        Dict with tracking status and events
        
    Raises:
        PaxiTrackingError: If tracking request fails
    """
    url = f"https://api.paxi.co.za/v1/track/{waybill_number}"
    headers = {"User-Agent": "EscrowMarketplace/1.0"}
    
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401 and not api_key:
            # API key required, fall back to scraping
            raise PaxiTrackingError("API key required")
        raise PaxiTrackingError(f"Paxi API error: {e.response.status_code}")
    except Exception as e:
        raise PaxiTrackingError(f"Paxi API request failed: {str(e)}")


def poll_paxi_web(waybill_number: str) -> str:
    """
    Lightweight fallback parser for Paxi public tracking without heavy browser automation.
    Uses httpx with browser-like headers to avoid bot detection.
    
    Args:
        waybill_number: The Paxi waybill/tracking number
        
    Returns:
        Current tracking status string (uppercase)
        
    Raises:
        PaxiTrackingError: If tracking request fails
    """
    url = f"https://www.paxi.co.za/tracking?waybill={waybill_number}"
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            
            if response.status_code != 200:
                raise PaxiTrackingError(f"Paxi web returned status {response.status_code}")
            
            soup = BeautifulSoup(response.text, "html.parser")
            
            # Try multiple possible selectors based on Paxi's web structure
            status_selectors = [
                ("div", "tracking-status-current"),
                ("div", "status-badge"),
                ("span", "tracking-status"),
                ("p", "status-text"),
            ]
            
            for tag, class_name in status_selectors:
                status_element = soup.find(tag, class_=class_name)
                if status_element:
                    return status_element.get_text(strip=True).upper()
            
            # Fallback: look for any element containing common status keywords
            status_keywords = ["COLLECTED", "DELIVERED", "IN TRANSIT", "DISPATCHED", "AWAITING"]
            for keyword in status_keywords:
                element = soup.find(string=lambda text: text and keyword in text.upper())
                if element:
                    parent = element.find_parent()
                    if parent:
                        return element.strip().upper()
            
            return "UNKNOWN"
            
    except httpx.RequestError as e:
        raise PaxiTrackingError(f"Paxi web request failed: {str(e)}")


def parse_paxi_status(status_text: str) -> Optional[EscrowStatus]:
    """
    Map Paxi status text to internal escrow status.
    
    Args:
        status_text: Raw status string from Paxi
        
    Returns:
        Corresponding EscrowStatus or None if not yet delivered
    """
    status_upper = status_text.upper()
    
    # Mapping of Paxi statuses to our escrow states
    if any(kw in status_upper for kw in ["COLLECTED BY BUYER", "READY FOR COLLECTION", "AVAILABLE"]):
        return EscrowStatus.DELIVERED_INSPECTION_WINDOW
    
    if any(kw in status_upper for kw in ["DELIVERED", "COMPLETED"]):
        return EscrowStatus.DELIVERED_INSPECTION_WINDOW
    
    if any(kw in status_upper for kw in ["IN TRANSIT", "DISPATCHED", "ON THE WAY"]):
        return EscrowStatus.SHIPPED
    
    if any(kw in status_upper for kw in ["AWAITING DROP", "PENDING", "CREATED"]):
        return EscrowStatus.HELD_IN_ESCROW
    
    return None


def check_paxi_waybill(
    session: Session,
    waybill_number: str,
    api_key: Optional[str] = None
) -> Dict:
    """
    Check Paxi waybill status using API or web fallback.
    
    Tries official API first, falls back to web scraping if API unavailable.
    
    Args:
        session: SQLAlchemy database session
        waybill_number: The Paxi waybill to track
        api_key: Optional Paxi API key
        
    Returns:
        Dict with status, raw_data, and updated flag
    """
    tracking_data = None
    status_text = "UNKNOWN"
    
    # Try API first
    try:
        tracking_data = poll_paxi_api(waybill_number, api_key)
        status_text = tracking_data.get("status", "UNKNOWN")
    except PaxiTrackingError:
        # Fall back to web scraping
        try:
            status_text = poll_paxi_web(waybill_number)
            tracking_data = {"status": status_text, "source": "web_scrape"}
        except PaxiTrackingError as e:
            # Both methods failed
            return {
                "status": "TRACKING_ERROR",
                "error": str(e),
                "updated": False
            }
    
    # Find the order with this waybill
    order = session.query(Order).filter(Order.paxi_waybill == waybill_number).first()
    
    if not order:
        return {
            "status": status_text,
            "raw_data": tracking_data,
            "updated": False,
            "message": "No order found for this waybill"
        }
    
    # Map Paxi status to our escrow status
    mapped_status = parse_paxi_status(status_text)
    
    if not mapped_status:
        return {
            "status": status_text,
            "raw_data": tracking_data,
            "updated": False,
            "message": "Status not yet actionable"
        }
    
    # Check if we need to update the order state
    needs_update = order.escrow_status != mapped_status
    
    if needs_update:
        try:
            transition_order_state(
                session=session,
                order_id=order.id,
                target_status=mapped_status,
                extra_data={
                    "paxi_tracking_data": json.dumps(tracking_data),
                    "updated_at": datetime.utcnow()
                }
            )
            
            return {
                "status": status_text,
                "raw_data": tracking_data,
                "updated": True,
                "new_state": mapped_status.value,
                "order_id": order.id
            }
            
        except InvalidStateTransition as e:
            return {
                "status": status_text,
                "raw_data": tracking_data,
                "updated": False,
                "error": f"State transition blocked: {str(e)}"
            }
    
    # No update needed - status unchanged
    return {
        "status": status_text,
        "raw_data": tracking_data,
        "updated": False,
        "message": "Status unchanged"
    }


def batch_track_waybills(
    session: Session,
    waybills: List[str],
    api_key: Optional[str] = None
) -> List[Dict]:
    """
    Track multiple waybills in batch.
    
    Args:
        session: SQLAlchemy database session
        waybills: List of waybill numbers to track
        api_key: Optional Paxi API key
        
    Returns:
        List of tracking results for each waybill
    """
    results = []
    
    for waybill in waybills:
        result = check_paxi_waybill(session, waybill, api_key)
        result["waybill"] = waybill
        results.append(result)
    
    return results
