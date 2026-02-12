/**
 * Run this on your LOCAL PC (not VPS) to generate Polymarket API keys.
 * 
 * Usage:
 *   1. Make sure your .env file has PRIVATE_KEY and FUNDER_ADDRESS
 *   2. Run: node generate-keys.js
 *   3. Copy the 3 values it prints into your VPS .env file
 */

const { ClobClient } = require("@polymarket/clob-client");
const { Wallet } = require("@ethersproject/wallet");
const { JsonRpcProvider } = require("@ethersproject/providers");
const fs = require("fs");

// Load .env manually
const envFile = fs.readFileSync(".env", "utf8");
const env = {};
envFile.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) return;
  env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
});

async function main() {
  const privateKey = env.PRIVATE_KEY;
  const funderAddress = env.FUNDER_ADDRESS;
  const host = env.CLOB_API_URL || "https://clob.polymarket.com";
  const chainId = parseInt(env.CHAIN_ID || "137");
  const sigType = parseInt(env.SIGNATURE_TYPE || "0");
  const rpc = env.POLYGON_RPC_URL || "https://polygon-rpc.com";

  if (!privateKey || !funderAddress) {
    console.error("ERROR: Set PRIVATE_KEY and FUNDER_ADDRESS in your .env file first");
    process.exit(1);
  }

  console.log("Connecting to Polymarket...");
  const provider = new JsonRpcProvider(rpc);
  const signer = new Wallet(privateKey, provider);
  const client = new ClobClient(host, chainId, signer, undefined, sigType, funderAddress);

  console.log("Generating API keys...");
  const creds = await client.createOrDeriveApiKey();

  console.log("\n========================================");
  console.log("  Add these 3 lines to your VPS .env:");
  console.log("========================================\n");
  console.log(`CLOB_API_KEY=${creds.key}`);
  console.log(`CLOB_SECRET=${creds.secret}`);
  console.log(`CLOB_PASSPHRASE=${creds.passphrase}`);
  console.log("\n========================================\n");
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
