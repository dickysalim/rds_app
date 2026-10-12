import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function App() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            RDS Factory Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Vite + React + TypeScript + Tailwind + shadcn/ui
          </p>
        </div>
        <Badge variant="secondary">v0.1.0</Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Starter</CardTitle>
          <CardDescription>
            This page exists to confirm the UI toolkit is wired up. Replace it
            with real views as the app is built out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button>Primary action</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
