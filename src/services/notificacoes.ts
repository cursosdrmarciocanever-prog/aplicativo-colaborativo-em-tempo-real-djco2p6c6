// src/services/notificacoes.ts
// Ativa, ajusta e desativa as notificações deste aparelho (Web Push).
// No iPhone só funciona com o app instalado na Tela de Início (iOS 16.4 ou mais novo).

import type { RecordModel } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface InscricaoPush extends RecordModel {
  usuario: string
  espaco: string
  endpoint: string
  aparelho?: string
  mamada: boolean
  mamada_antes_min: number
  mamada_atraso: boolean
  vacinas: boolean
  consultas: boolean
  familia: boolean
  remedios: boolean
  teste_em?: string
}

export type Preferencias = Pick<
  InscricaoPush,
  'mamada' | 'mamada_antes_min' | 'mamada_atraso' | 'remedios' | 'vacinas' | 'consultas' | 'familia'
>

export type Suporte = 'ok' | 'sem-suporte' | 'ios-instalar' | 'negado'

function ehIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function instalado(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function verificarSuporte(): Suporte {
  if (ehIos() && !instalado()) return 'ios-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'sem-suporte'
  }
  if (Notification.permission === 'denied') return 'negado'
  return 'ok'
}

/** Nome curto do aparelho, para a lista de quem recebe ("iPhone", "Android", "Mac"...). */
export function nomeDoAparelho(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  return 'Navegador'
}

function comLimite<T>(p: Promise<T>, ms: number, mensagem: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(mensagem)), ms)),
  ])
}

function registroDoServiceWorker(): Promise<ServiceWorkerRegistration> {
  return comLimite(
    navigator.serviceWorker.ready,
    8000,
    'O app ainda está carregando. Feche, abra de novo e tente outra vez.',
  )
}

function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const bin = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Inscrição deste aparelho no servidor (null se não ativou aqui). */
export async function inscricaoDesteAparelho(): Promise<InscricaoPush | null> {
  if (verificarSuporte() !== 'ok' || Notification.permission !== 'granted') return null
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return null
  try {
    return await pb
      .collection('push_inscricoes')
      .getFirstListItem<InscricaoPush>(pb.filter('endpoint = {:e}', { e: sub.endpoint }))
  } catch {
    return null
  }
}

export async function ativarNotificacoes(espacoId: string): Promise<InscricaoPush> {
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') {
    throw new Error('Permissão negada. Libere as notificações do app nos ajustes do celular.')
  }
  let chave: string
  try {
    chave = (await pb.send<{ chave: string }>('/backend/v1/push/chave', { method: 'GET' })).chave
  } catch {
    throw new Error('O servidor ainda não está pronto para notificações. Tente mais tarde.')
  }
  const reg = await registroDoServiceWorker()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await comLimite(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }),
      20000,
      'O serviço de notificações do celular não respondeu. Confira a internet e tente de novo.',
    )
  }
  const json = sub.toJSON()
  const resp = await pb.send<{ id: string }>('/backend/v1/push/inscrever', {
    method: 'POST',
    body: {
      espaco: espacoId,
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
      aparelho: nomeDoAparelho(),
    },
  })
  return pb.collection('push_inscricoes').getOne<InscricaoPush>(resp.id)
}

export function salvarPreferencias(id: string, prefs: Partial<Preferencias>) {
  return pb.collection('push_inscricoes').update<InscricaoPush>(id, prefs)
}

export function pedirTeste(id: string) {
  return pb.collection('push_inscricoes').update<InscricaoPush>(id, { teste_em: new Date().toISOString() })
}

export async function desativarNotificacoes(id: string) {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  await sub?.unsubscribe().catch(() => {})
  await pb.collection('push_inscricoes').delete(id).catch(() => {})
}
