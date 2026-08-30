import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { TravelPrivateState, Contract, Witnesses } from '../../contract/src/index.js';

export const travelPrivateStateKey = 'travelPrivateState';
export type PrivateStateId = typeof travelPrivateStateKey;

export type PrivateStates = {
  readonly travelPrivateState: TravelPrivateState;
};

export type TravelContract = Contract<TravelPrivateState, Witnesses<TravelPrivateState>>;

export type TravelCircuitKeys = Exclude<keyof TravelContract['impureCircuits'], number | symbol>;

export type TravelProviders = MidnightProviders<TravelCircuitKeys, PrivateStateId, TravelPrivateState>;

export type DeployedTravelContract = FoundContract<TravelContract>;

export type TravelDerivedState = {
  readonly is_occupied: bigint;
  readonly message: string | undefined;
};
