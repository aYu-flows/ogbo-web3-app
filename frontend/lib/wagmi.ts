import { createAppKit } from '@reown/appkit/react'
import { mainnet, bsc, polygon } from '@reown/appkit/networks'
import type { AppKitNetwork } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import type { WalletClient } from 'viem'
import { ethers } from 'ethers'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const metadata = {
  name: 'OGBO',
  description: 'OGBO Web3 Social Wallet',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://ogbo.app',
  icons: ['/logo/logo.png'],
}

export const networks = [mainnet, bsc, polygon] as [AppKitNetwork, ...AppKitNetwork[]]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
})

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
  },
  themeMode: 'light',
})

export const wagmiConfig = wagmiAdapter.wagmiConfig

/**
 * Convert viem WalletClient to ethers.js v5 Signer.
 * Push Protocol SDK requires ethers v5 signer.
 */
export async function walletClientToSigner(walletClient: WalletClient): Promise<ethers.Signer> {
  const { account, chain, transport } = walletClient
  if (!account || !chain) {
    throw new Error('WalletClient missing account or chain')
  }
  const network = {
    chainId: chain.id,
    name: chain.name,
  }
  const provider = new ethers.providers.Web3Provider(transport as ethers.providers.ExternalProvider, network)
  return provider.getSigner(account.address)
}
