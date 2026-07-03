"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NewFlowButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function createFlow() {
    setIsCreating(true);

    const response = await fetch("/api/flows", {
      method: "POST",
    });

    if (!response.ok) {
      setIsCreating(false);
      return;
    }

    const payload = (await response.json()) as {
      flow: {
        id: string;
      };
    };

    router.push(`/fluxos/${payload.flow.id}`);
  }

  return (
    <Button onClick={createFlow} disabled={isCreating}>
      {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
      Novo fluxo
    </Button>
  );
}
