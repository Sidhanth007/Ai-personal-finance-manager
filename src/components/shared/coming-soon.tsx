import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ phase, feature }: { phase: number; feature: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Coming in Phase {phase}</CardTitle>
        <CardDescription>{feature}</CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        This section is part of the phased build and will be enabled once its phase is approved.
      </CardContent>
    </Card>
  );
}
