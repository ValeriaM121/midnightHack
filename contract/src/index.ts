import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/travel/contract/index.js";
export * from "./witnesses.js";

import * as CompiledTravelContract from "./managed/travel/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const TravelContract = CompiledContract.make<
  CompiledTravelContract.Contract<Witnesses.TravelPrivateState>
>("travel", CompiledTravelContract.Contract<Witnesses.TravelPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/travel"),
);
