import { Shield } from "lucide-react";

const EscrowBadge = ({ small = false }: { small?: boolean }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-escrow/15 text-escrow font-medium ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"}`}>
    <Shield className={small ? "h-2.5 w-2.5" : "h-3 w-3"} />
    Escrow Secured
  </span>
);

export default EscrowBadge;
