"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveCategoryAction, setCategoryArchivedAction } from "@/server/actions/categories";
import type { ActionState } from "@/server/actions/transactions";
import type { CategoryRow } from "@/server/services/transactions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function useToastState(state: ActionState) {
  useEffect(() => {
    if (state.ok) toast.success(state.message);
    else if (state.error) toast.error(state.error);
  }, [state]);
}

function NewCategoryForm({ type }: { type: "income" | "expense" }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveCategoryAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useToastState(state);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form action={formAction} ref={formRef} className="flex items-center gap-2">
      <input type="hidden" name="type" value={type} />
      <input type="color" name="color" defaultValue="#64748b" className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1" aria-label="Color" />
      <Input name="name" placeholder={`New ${type} category`} maxLength={40} required />
      <Button type="submit" size="sm" disabled={pending}>
        <Plus className="size-4" /> Add
      </Button>
    </form>
  );
}

function CategoryItem({ category }: { category: CategoryRow }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveCategoryAction, {});
  const [archiving, startTransition] = useTransition();
  useToastState(state);

  function toggleArchive() {
    startTransition(async () => {
      const res = await setCategoryArchivedAction(category.id, !category.isArchived);
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });
  }

  return (
    <form
      action={formAction}
      className={cn("flex items-center gap-2", category.isArchived && "opacity-60")}
    >
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="type" value={category.type} />
      <input
        type="color"
        name="color"
        defaultValue={category.color ?? "#64748b"}
        className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        aria-label={`Color for ${category.name}`}
      />
      <Input name="name" defaultValue={category.name} maxLength={40} required aria-label={`Name for ${category.name}`} />
      {category.isDefault && <Badge variant="secondary" className="hidden sm:inline-flex">default</Badge>}
      {category.isArchived && <Badge variant="outline" className="hidden sm:inline-flex">archived</Badge>}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={archiving}
        onClick={toggleArchive}
        aria-label={category.isArchived ? "Restore" : "Archive"}
      >
        {category.isArchived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </Button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const groups: { type: "expense" | "income"; title: string; description: string }[] = [
    { type: "expense", title: "Expense categories", description: "Where your money goes." },
    { type: "income", title: "Income categories", description: "Where your money comes from." },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {groups.map((g) => (
        <Card key={g.type}>
          <CardHeader>
            <CardTitle>{g.title}</CardTitle>
            <CardDescription>{g.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <NewCategoryForm type={g.type} />
            <div className="space-y-2 border-t pt-3">
              {categories
                .filter((c) => c.type === g.type)
                .map((c) => (
                  <CategoryItem key={c.id} category={c} />
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
