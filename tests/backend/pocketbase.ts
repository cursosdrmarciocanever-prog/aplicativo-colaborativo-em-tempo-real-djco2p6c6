// Sobe um PocketBase descartável com as migrações e hooks do repositório.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import PocketBase from 'pocketbase'

const raiz = path.resolve(__dirname, '../..')
export const binario = process.env.POCKETBASE_BIN || path.join(raiz, '.pocketbase/pocketbase')
export const temBinario = existsSync(binario)

const SUPER_EMAIL = 'super@teste.local'
const SUPER_SENHA = 'SuperSenhaDeTeste123'

export interface Servidor {
  url: string
  admin: PocketBase
  parar: () => void
}

export async function subirPocketBase(): Promise<Servidor> {
  const dados = mkdtempSync(path.join(tmpdir(), 'pb-teste-'))
  // No Skip Cloud os hooks são arquivos .js comuns; o PocketBase padrão só carrega *.pb.js.
  const hooks = path.join(dados, 'hooks')
  mkdirSync(hooks)
  for (const arq of readdirSync(path.join(raiz, 'pocketbase/hooks'))) {
    if (arq.endsWith('.js')) {
      copyFileSync(path.join(raiz, 'pocketbase/hooks', arq), path.join(hooks, arq.replace(/\.js$/, '.pb.js')))
    }
  }
  const porta = 18000 + Math.floor(Math.random() * 1000)
  const args = [
    `--dir=${path.join(dados, 'pb_data')}`,
    `--migrationsDir=${path.join(raiz, 'pocketbase/migrations')}`,
    `--hooksDir=${hooks}`,
  ]
  execFileSync(binario, ['migrate', 'up', ...args], { stdio: 'ignore' })
  execFileSync(binario, ['superuser', 'upsert', SUPER_EMAIL, SUPER_SENHA, ...args], {
    stdio: 'ignore',
  })

  const proc: ChildProcess = spawn(binario, ['serve', `--http=127.0.0.1:${porta}`, ...args], {
    stdio: 'ignore',
  })
  const url = `http://127.0.0.1:${porta}`

  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${url}/api/health`)
      if (r.ok) break
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  const admin = new PocketBase(url)
  admin.autoCancellation(false)
  await admin.collection('_superusers').authWithPassword(SUPER_EMAIL, SUPER_SENHA)

  return {
    url,
    admin,
    parar: () => {
      proc.kill()
      rmSync(dados, { recursive: true, force: true })
    },
  }
}

/** Cria um usuário e devolve um cliente autenticado como ele (sem senha: via impersonate). */
export async function criarUsuario(s: Servidor, nome: string) {
  const senha = 'x' + Math.random().toString(36).slice(2) + 'Aa1!'
  const email = `${nome.toLowerCase()}@teste.local`
  const user = await s.admin.collection('users').create({
    email,
    name: nome,
    password: senha,
    passwordConfirm: senha,
    verified: true,
  })
  const cliente = await s.admin.collection('users').impersonate(user.id, 3600)
  cliente.autoCancellation(false)
  return { id: user.id as string, email, cliente }
}
