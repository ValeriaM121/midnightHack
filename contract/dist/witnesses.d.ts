import { Ledger } from "./managed/bboard/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
export type BBoardPrivateState = {
    readonly secretKey: Uint8Array;
};
export declare const createBBoardPrivateState: (secretKey: Uint8Array) => {
    secretKey: Uint8Array<ArrayBufferLike>;
};
export declare const witnesses: {
    localSecretKey: ({ privateState, }: WitnessContext<Ledger, BBoardPrivateState>) => [BBoardPrivateState, Uint8Array];
};
