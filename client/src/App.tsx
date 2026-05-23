import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import { useState } from "react";
import type { FichierGrille } from "@/lib/excelUtils";

// Contexte partagé entre Home et Dashboard pour le fichier grille
function AppContent() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [fichierGrille, setFichierGrille] = useState<FichierGrille | null>(null);

  if (showDashboard) {
    return (
      <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif" }}>
        <Dashboard
          fichierGrille={fichierGrille}
          onRetour={() => setShowDashboard(false)}
        />
      </div>
    );
  }

  return (
    <Home
      onShowDashboard={() => setShowDashboard(true)}
      onFichierGrilleChange={setFichierGrille}
      fichierGrilleExternal={fichierGrille}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={AppContent} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
