import { Construction } from 'lucide-react';

/** Placeholder rendered by routes whose feature is not implemented yet. */
const UnderDevelopment = () => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
    <Construction className="size-10 text-muted-foreground" />
    <h1 className="text-2xl font-semibold text-foreground">Em desenvolvimento</h1>
    <p className="text-sm text-muted-foreground">
      Esta funcionalidade estará disponível em breve.
    </p>
  </div>
);

export default UnderDevelopment;
