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
  featuredWalletIds: [
    "971e689d0a5be527bac79dbb1d59ffa3f290fbe6cb2fb928c0c32d5a28a3b7b3", // OKX Wallet
    "20459438007b75f4f4acb98bf29aa3b800550309646d375da5fd4aac6c2a2c66", // Token Pocket
    "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // MetaMask
    "8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4", // Binance Wallet
  ],
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
