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
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(deployment: BehaviorSubject<BoardDeployment>): Promise<void> {
    try {
      const providers = await this.getProviders();
      const api = await TravelAPI.deploy(providers, this.logger);

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
      const providers = await this.getProviders();
      const api = await TravelAPI.join(providers, contractAddress, this.logger);

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
  const networkId = import.meta.env.VITE_NETWORK_ID as NetworkId;
  const connectedAPI = await connectToWallet(logger, networkId);
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<TravelCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  const inMemoryTravelPrivateStateProvider = inMemoryPrivateStateProvider<string, TravelPrivateState>();
  const shieldedAddresses = await connectedAPI.getShieldedAddresses();
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
const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  console.log('--- DIAGNOSTICS: getFirstCompatibleWallet ---');
  console.log('window.midnight object:', (window as any).midnight);
  if (!(window as any).midnight) {
    console.warn('window.midnight is undefined');
    return undefined;
  }
  
  const wallets = Object.entries((window as any).midnight);
  console.log('Available wallets:', wallets);
  
  for (const [key, wallet] of wallets) {
    console.log(`Evaluating wallet [${key}]:`, wallet);
    if (wallet && typeof wallet === 'object' && 'apiVersion' in (wallet as any)) {
      const apiVersion = (wallet as any).apiVersion;
      console.log(`Wallet [${key}] apiVersion:`, apiVersion);
      const isCompatible = semver.satisfies(apiVersion, COMPATIBLE_CONNECTOR_API_VERSION);
      console.log(`Wallet [${key}] is compatible with ${COMPATIBLE_CONNECTOR_API_VERSION}?`, isCompatible);
      if (isCompatible) {
         return wallet as InitialAPI;
      }
    } else {
      console.log(`Wallet [${key}] is missing apiVersion or is not a valid object.`);
    }
  }
  return undefined;
};

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** @internal */
const connectToWallet = async (logger: Logger, networkId: string): Promise<ConnectedAPI> => {
  console.log('--- DIAGNOSTICS: connectToWallet ---');
  console.log(`Target Network ID: ${networkId}`);
  
  const existingAPI = getFirstCompatibleWallet();
  if (existingAPI) {
    console.log('Synchronous wallet API found. Attempting to connect...');
    try {
      const connectedAPI = await existingAPI.connect(networkId);
      console.log('connect() returned successfully:', connectedAPI);
      const connectionStatus = await connectedAPI.getConnectionStatus();
      console.log('Connection status:', connectionStatus);
      return connectedAPI;
    } catch (error: any) {
      console.error('existingAPI.connect() threw an error:', error);
      throw new Error(`Connection Error: ${error?.message || String(error)}`);
    }
  }

  console.log('No synchronous wallet API found. Falling back to polling for 1 second...');
  return firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getFirstCompatibleWallet()),
      tap((connectorAPI) => {
        if (connectorAPI) console.log('Polling found connectorAPI:', connectorAPI);
      }),
      filter((connectorAPI): connectorAPI is InitialAPI => !!connectorAPI),
      take(1),
      timeout({
        first: 1_000,
        with: () =>
          throwError(() => {
            console.error('Polling timed out (1 second) without finding a compatible wallet.');
            return new Error('Could not find Midnight Lace wallet. Extension installed and compatible?');
          }),
      }),
      concatMap(async (initialAPI) => {
        console.log('Attempting asynchronous connect()...');
        try {
          const connectedAPI = await initialAPI.connect(networkId);
          return connectedAPI;
        } catch (error: any) {
          console.error('asynchronous connect() threw an error:', error);
          throw new Error(`Async Connection Error: ${error?.message || String(error)}`);
        }
      }),
      catchError((error, apis) => {
        console.error('catchError triggered in pipeline with error:', error);
        return throwError(() => error);
      })
    ),
  );
};
