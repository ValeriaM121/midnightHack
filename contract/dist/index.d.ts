import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
export * from "./managed/bboard/contract/index.js";
export * from "./witnesses";
import * as CompiledBBoardContract from "./managed/bboard/contract/index.js";
import * as Witnesses from "./witnesses";
export declare const CompiledBBoardContractContract: CompiledContract.CompiledContract<CompiledBBoardContract.Contract<Witnesses.BBoardPrivateState, CompiledBBoardContract.Witnesses<Witnesses.BBoardPrivateState>>, Witnesses.BBoardPrivateState, never>;
