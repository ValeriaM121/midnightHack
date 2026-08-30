import * as Travel from '../../contract/src/managed/travel/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type TravelDerivedState,
  type TravelContract,
  type TravelProviders,
  type DeployedTravelContract,
  travelPrivateStateKey,
} from './common-types.js';
import { TravelContract as CompiledTravelContract } from '../../contract/src/index.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { TravelPrivateState, createTravelPrivateState } from '../../contract/src/witnesses.js';

export interface DeployedTravelAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TravelDerivedState>;

  proveEligibilityAndAttest: (minValidityDays: bigint, allowedNationality: Uint8Array, publicMessage: string, privateNationality: Uint8Array, privateValidityDays: bigint) => Promise<void>;
}

export class TravelAPI implements DeployedTravelAPI {
  private constructor(
    public readonly deployedContract: DeployedTravelContract,
    private readonly providers: TravelProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => Travel.ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                },
              },
            }),
          ),
        ),
        from(providers.privateStateProvider.get(travelPrivateStateKey) as Promise<TravelPrivateState>),
      ],
      (ledgerState, privateState) => {
        return {
          is_occupied: ledgerState.is_occupied,
          message: ledgerState.message.is_some ? ledgerState.message.value : undefined,
        };
      },
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<TravelDerivedState>;

  async proveEligibilityAndAttest(minValidityDays: bigint, allowedNationality: Uint8Array, publicMessage: string, privateNationality: Uint8Array, privateValidityDays: bigint): Promise<void> {
    this.logger?.info(`proveEligibilityAndAttest`);
    
    await this.providers.privateStateProvider.set(
      travelPrivateStateKey,
      createTravelPrivateState(privateNationality, privateValidityDays)
    );

    const txData = await this.deployedContract.callTx.prove_eligibility_and_attest(minValidityDays, allowedNationality, publicMessage);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'prove_eligibility_and_attest',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  static async deploy(providers: TravelProviders, logger?: Logger): Promise<TravelAPI> {
    logger?.info('deployContract');
    // Using default empty arrays/values for initial private state, will be updated before proof
    const deployedTravelContract = await deployContract(providers, {
      compiledContract: CompiledTravelContract,
      privateStateId: travelPrivateStateKey,
      initialPrivateState: createTravelPrivateState(new Uint8Array(32), 0n),
    });

    return new TravelAPI(deployedTravelContract, providers, logger);
  }

  static async join(providers: TravelProviders, contractAddress: ContractAddress, logger?: Logger): Promise<TravelAPI> {
    logger?.info({ joinContract: { contractAddress } });
    const deployedTravelContract = await findDeployedContract<TravelContract>(providers, {
      contractAddress,
      compiledContract: CompiledTravelContract,
      privateStateId: travelPrivateStateKey,
      initialPrivateState: await TravelAPI.getPrivateState(providers, contractAddress),
    });

    return new TravelAPI(deployedTravelContract, providers, logger);
  }

  private static async getPrivateState(
    providers: TravelProviders,
    contractAddress: ContractAddress,
  ): Promise<TravelPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(travelPrivateStateKey);
    return existingPrivateState ?? createTravelPrivateState(new Uint8Array(32), 0n);
  }
}

export * as utils from './utils/index.js';
export * from './common-types.js';
