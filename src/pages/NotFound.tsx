/* 404 Page - Diário da Sarah em português */
import { useLocation, Link } from 'react-router-dom'
import { Heart, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NotFound = () => {
  const location = useLocation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[420px] text-center bg-card p-8 rounded-[24px] border border-border shadow-sm space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
          <Heart className="w-8 h-8 fill-primary" />
        </div>
        <h1 className="text-3xl font-extrabold text-foreground">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          O caminho que você tentou acessar ({location.pathname}) não existe no Diário da Sarah.
        </p>
        <div className="pt-2">
          <Button
            asChild
            className="w-full h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link to="/hoje">
              <Home className="w-4 h-4 mr-2" />
              Voltar para a tela Hoje
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NotFound
