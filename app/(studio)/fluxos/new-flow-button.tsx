import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NewFlowButton() {
  return (
    <Button asChild>
      <Link href="/criar">
        <Plus />
        Novo fluxo
      </Link>
    </Button>
  );
}
