// This file is part of midnightntwrk/example-bboard.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  TravelAPI,
  type TravelCircuitKeys,
  type TravelProviders,
  type DeployedTravelAPI,
} from '../../../api/src/index.js';
import { type ContractAddress, fromHex, toHex } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  BehaviorSubject,
  catchError,
  concatMap,
  filter,
  firstValueFrom,
  interval,
  map,
  type Observable,
  take,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { ConnectedAPI, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import semver from 'semver';
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { type TravelPrivateState } from '../../../contract/src/witnesses.js';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';

export interface InProgressBoardDeployment {
  readonly status: 'in-progress';
}

export interface DeployedBoardDeployment {
  readonly status: 'deployed';
  readonly api: DeployedTravelAPI;
}

export interface FailedBoardDeployment {
  readonly status: 'failed';
  readonly error: Error;
}

export type BoardDeployment = InProgressBoardDeployment | DeployedBoardDeployment | FailedBoardDeployment;

export interface DeployedBoardAPIProvider {
  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;
  readonly resolve: (contractAddress?: ContractAddress) => Observable<BoardDeployment>;
}

export class BrowserDeployedBoardManager implements DeployedBoardAPIProvider {
  readonly #boardDeploymentsSubject: BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>;
  #initializedProviders: Promise<TravelProviders> | undefined;

  constructor(private readonly logger: Logger) {
    this.#boardDeploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<BoardDeployment>>>([]);
    this.boardDeployments$ = this.#boardDeploymentsSubject;
  }

  readonly boardDeployments$: Observable<Array<Observable<BoardDeployment>>>;

  resolve(contractAddress?: ContractAddress): Observable<BoardDeployment> {
    const deployments = this.#boardDeploymentsSubject.value;
    let deployment = deployments.find(
      (deployment) =>
        deployment.value.status === 'deployed' && deployment.value.api.deployedContractAddress === contractAddress,
    );

    if (deployment) {
      return deployment;
    }

    deployment = new BehaviorSubject<BoardDeployment>({
      status: 'in-progress',
    });

    if (contractAddress) {
      void this.joinDeployment(deployment, contractAddress);
    } else {
      void this.deployDeployment(deployment);
    }

    this.#boardDeploymentsSubject.next([...deployments, deployment]);

    return deployment;
  }

  private getProviders(): Promise<TravelProviders> {
    if (!this.#initializedProviders) {
      this.#initializedProviders = initializeProviders(this.logger).catch((err) => {
        this.#initializedProviders = undefined;
        throw err;
      });
    }
    return this.#initializedProviders;
  }

  private async deployDeployment(deployment: BehaviorSubject<BoardDeployment>): Promise<void> {
    try {
      console.log('[deployDeployment] Getting providers...');
      const providers = await this.getProviders();
      console.log('[deployDeployment] Calling TravelAPI.deploy...');
      const api = await TravelAPI.deploy(providers, this.logger);
      console.log('[deployDeployment] TravelAPI.deploy succeeded!');

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<BoardDeployment>,
    contractAddress: ContractAddress,
  ): Promise<void> {
    try {
      console.log('[joinDeployment] Getting providers...');
      const providers = await this.getProviders();
      console.log('[joinDeployment] Calling TravelAPI.join...');
      const api = await TravelAPI.join(providers, contractAddress, this.logger);
      console.log('[joinDeployment] TravelAPI.join succeeded!');

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

/** @internal */
const initializeProviders = async (logger: Logger): Promise<TravelProviders> => {
  console.log('[initializeProviders] Starting...');
  const networkId = import.meta.env.VITE_NETWORK_ID as NetworkId;
  
  console.log('[initializeProviders] Calling connectToWallet...');
  const connectedAPI = await connectToWallet(logger, networkId);
  console.log('[initializeProviders] connectToWallet succeeded!');
  
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<TravelCircuitKeys>(zkConfigPath, fetch.bind(window));
  
  console.log('[initializeProviders] Calling connectedAPI.getConfiguration()...');
  const config = await connectedAPI.getConfiguration();
  console.log('[initializeProviders] getConfiguration succeeded:', config);
  
  const inMemoryTravelPrivateStateProvider = inMemoryPrivateStateProvider<string, TravelPrivateState>();
  
  console.log('[initializeProviders] Calling connectedAPI.getShieldedAddresses()...');
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
  console.log('[initializeProviders] getShieldedAddresses succeeded!');
  
  console.log('[initializeProviders] Returning providers...');
  return {
    privateStateProvider: inMemoryTravelPrivateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> => {
        try {
          logger.info({ tx, ttl }, 'Balancing transaction via wallet');
          const serializedTx = toHex(tx.serialize());
          const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(received.tx),
          );
        } catch (e) {
          logger.error({ error: e }, 'Error balancing transaction via wallet');
          throw e;
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        const txIdentifiers = tx.identifiers();
        const txId = txIdentifiers[0]; // Return the first transaction ID
        logger.info({ txIdentifiers }, 'Submitted transaction via wallet');
        return txId;
      },
    },
  };
};

/** @internal */
const getCompatibleWallets = (): Array<{ id: string, api: InitialAPI }> => {
  console.log('--- DIAGNOSTICS: getCompatibleWallets ---');
  if (!(window as any).midnight) {
    console.warn('window.midnight is undefined');
    return [];
  }
  
  const wallets = Object.entries((window as any).midnight);
  const compatibleWallets: Array<{ id: string, api: InitialAPI }> = [];
  
  for (const [key, wallet] of wallets) {
    if (wallet && typeof wallet === 'object') {
      const apiVersion = (wallet as any).apiVersion;
      let isCompatible = false;
      if (apiVersion) {
        isCompatible = semver.satisfies(apiVersion, COMPATIBLE_CONNECTOR_API_VERSION);
      }
      if (isCompatible) {
         compatibleWallets.push({ id: key, api: wallet as InitialAPI });
      }
    }
  }
  
  return compatibleWallets;
};

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** @internal */
const connectToWallet = async (logger: Logger, networkId: string): Promise<ConnectedAPI> => {
  console.log('--- DIAGNOSTICS: connectToWallet ---');
  console.log(`Target Network ID: ${networkId}`);
  
  const existingWallets = getCompatibleWallets();
  if (existingWallets.length > 0) {
    console.log(`Found ${existingWallets.length} compatible wallets synchronously. Attempting sequential connection...`);
    for (const { id, api } of existingWallets) {
      try {
        console.log(`[Wallet Selection] Attempting connect() on UUID: ${id}`);
        const connectedAPI = await api.connect(networkId);
        console.log(`[Wallet Selection] connect() SUCCESS on UUID: ${id}`);
        return connectedAPI;
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        console.warn(`[Wallet Selection] connect() FAILED on UUID: ${id}`, errMsg);
        if (errMsg.includes('shutdown') || errMsg.includes('object can no longer be used')) {
          console.warn(`[Wallet Selection] UUID ${id} is a dead proxy. Skipping to next wallet...`);
          continue;
        }
        throw new Error(`Connection Error: ${errMsg}`);
      }
    }
    throw new Error('All compatible wallets failed to connect (likely due to closed remote channels). Please refresh the page and try again.');
  }

  console.log('No synchronous wallet API found. Falling back to polling for 1 second...');
  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getCompatibleWallets()),
      filter((wallets) => wallets.length > 0),
      take(1),
      timeout({
        first: 1_000,
        with: () =>
          throwError(() => {
            console.error('Polling timed out (1 second) without finding a compatible wallet.');
            return new Error('Could not find Midnight Lace wallet. Extension installed and compatible?');
          }),
      }),
      concatMap(async (wallets) => {
        console.log(`Found ${wallets.length} compatible wallets asynchronously. Attempting sequential connection...`);
        for (const { id, api } of wallets) {
          try {
            console.log(`[Wallet Selection] Async Attempting connect() on UUID: ${id}`);
            const connectedAPI = await api.connect(networkId);
            console.log(`[Wallet Selection] Async connect() SUCCESS on UUID: ${id}`);
            return connectedAPI;
          } catch (error: any) {
            const errMsg = error?.message || String(error);
            console.warn(`[Wallet Selection] Async connect() FAILED on UUID: ${id}`, errMsg);
            if (errMsg.includes('shutdown') || errMsg.includes('object can no longer be used')) {
               console.warn(`[Wallet Selection] Polled UUID ${id} is a dead proxy. Skipping...`);
               continue;
            }
            throw new Error(`Async Connection Error: ${errMsg}`);
          }
        }
        throw new Error('All polled compatible wallets failed to connect (channels shutdown). Please refresh the page.');
      })
    ),
  );
};
