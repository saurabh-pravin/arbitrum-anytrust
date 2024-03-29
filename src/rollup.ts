import { Chain, createPublicClient, decodeEventLog, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import {
  createRollupPrepareConfig,
  prepareChainConfig,
  createRollupPrepareTransactionRequest,
  createRollupPrepareTransactionReceipt,
  CreateRollupTransactionReceipt,
  createRollupEnoughCustomFeeTokenAllowance,
  createRollupPrepareCustomFeeTokenApprovalTransactionRequest
} from '@arbitrum/orbit-sdk';
import { generateChainId } from '@arbitrum/orbit-sdk/utils';
import { truncateSync } from 'fs';

export function sanitizePrivateKey(privateKey: string): `0x${string}` {
  if (!privateKey.startsWith('0x')) {
    return `0x${privateKey}`;
  }

  return privateKey as `0x${string}`;
}

function withFallbackPrivateKey(privateKey: string | undefined): `0x${string}` {
  if (typeof privateKey === 'undefined') {
    return generatePrivateKey();
  }

  return sanitizePrivateKey(privateKey);
}

function getBlockExplorerUrl(chain: Chain) {
  return chain.blockExplorers?.default.url;
}

if (typeof process.env.DEPLOYER_PRIVATE_KEY === 'undefined') {
  throw new Error(
    `Please provide the "DEPLOYER_PRIVATE_KEY" environment variable`
  );
}

// load or generate a random batch poster account
const batchPosterPrivateKey = withFallbackPrivateKey(
  process.env.BATCH_POSTER_PRIVATE_KEY
);
const batchPoster = privateKeyToAccount(batchPosterPrivateKey).address;

// load or generate a random validator account
const validatorPrivateKey = withFallbackPrivateKey(
  process.env.VALIDATOR_PRIVATE_KEY
);
const validator = privateKeyToAccount(validatorPrivateKey).address;

// set the parent chain and create a public client for it
const parentChain = arbitrumSepolia;
const parentChainPublicClient = createPublicClient({
  chain: parentChain,
  transport: http()
});

// load the deployer account
const deployer = privateKeyToAccount(
  sanitizePrivateKey(process.env.DEPLOYER_PRIVATE_KEY)
);

export async function rollup() {
  // generate a random chain id
  const chainId = generateChainId();

  // create the chain config
  const chainConfig = prepareChainConfig({
    chainId,
    arbitrum: {
      InitialChainOwner: deployer.address,
      DataAvailabilityCommittee: true
    }
  });
if (process.env.NATIVE_TOKEN!=='0x0000000000000000000000000000000000000000') {
  const allowanceParams = {
    nativeToken: process.env.NATIVE_TOKEN! as `0x${string}`,
    account: deployer.address,
    publicClient: parentChainPublicClient,
  };

  if (!(await createRollupEnoughCustomFeeTokenAllowance(allowanceParams))) {
    const approvalTxRequest = await createRollupPrepareCustomFeeTokenApprovalTransactionRequest(
      allowanceParams,
    );

    // sign and send the transaction
    const approvalTxHash = await parentChainPublicClient.sendRawTransaction({
      serializedTransaction: await deployer.signTransaction(approvalTxRequest),
    });

    // get the transaction receipt after waiting for the transaction to complete
    const approvalTxReceipt = createRollupPrepareTransactionReceipt(
      await parentChainPublicClient.waitForTransactionReceipt({
        hash: approvalTxHash,
      }),
    );

    console.log(
      `Tokens approved in ${getBlockExplorerUrl(parentChain)}/tx/${
        approvalTxReceipt.transactionHash
      }`,
    );
  }
}
const createRollupParams:any = {
  params: {
    config: createRollupPrepareConfig({
      chainId: BigInt(chainId),
      owner: deployer.address,
      chainConfig
    }),
    batchPoster,
    validators: [validator],
  },
  account: deployer.address,
  publicClient: parentChainPublicClient
}

if(process.env.NATIVE_TOKEN !== '0x0000000000000000000000000000000000000000'){
  createRollupParams.params["nativeToken"] = process.env.NATIVE_TOKEN as `0x${string}`
  createRollupParams.params.deployFactoriesToL2 = true
}


// prepare the transaction for deploying the core contracts
const request = await createRollupPrepareTransactionRequest(createRollupParams);

  // sign and send the transaction
  const txHash = await parentChainPublicClient.sendRawTransaction({
    serializedTransaction: await deployer.signTransaction(request)
  });

  // get the transaction receipt after waiting for the transaction to complete
  const txReceipt = createRollupPrepareTransactionReceipt(
    await parentChainPublicClient.waitForTransactionReceipt({ hash: txHash })
  );

  console.log(
    `Deployed in ${getBlockExplorerUrl(parentChain)}/tx/${
      txReceipt.transactionHash
    }`
  );

  return txReceipt.transactionHash;
}
function findRollupCreatedEventLog(txReceipt: CreateRollupTransactionReceipt) {
  throw new Error('Function not implemented.');
}

function decodeRollupCreatedEventLog(eventLog: any) {
  throw new Error('Function not implemented.');
}
