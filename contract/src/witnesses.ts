import { Ledger, PassportData } from "./managed/travel/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type TravelPrivateState = {
  readonly nationality: Uint8Array;
  readonly validityDays: bigint;
};

export const createTravelPrivateState = (nationality: Uint8Array, validityDays: bigint): TravelPrivateState => ({
  nationality,
  validityDays
});

export const witnesses = {
  passport_data: ({
    privateState,
  }: WitnessContext<Ledger, TravelPrivateState>): [
    TravelPrivateState,
    PassportData,
  ] => [privateState, { nationality: privateState.nationality, validity_days: privateState.validityDays }],
};
