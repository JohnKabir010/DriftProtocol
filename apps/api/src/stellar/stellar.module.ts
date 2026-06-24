import { Global, Module } from "@nestjs/common";
import { StellarService } from "./stellar.service";
import { ChainTxService } from "./chain-tx.service";
import { ChainReconcilerService } from "./chain-reconciler.service";

@Global()
@Module({
  providers: [StellarService, ChainTxService, ChainReconcilerService],
  exports: [StellarService, ChainTxService],
})
export class StellarModule {}
