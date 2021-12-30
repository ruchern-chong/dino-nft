const fetch = require("node-fetch");
const path = require("path");
const basePath = process.cwd();
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const AUTH = process.env.NFTPORT_API_KEY;
const CONTRACT_ADDRESS = process.env.MINT_CONTRACT_ADDRESS;
const MINT_TO_ADDRESS = process.env.CREATOR_WALLET_ADDRESS;
const CHAIN = "rinkeby";
const TIMEOUT = 5000; // Milliseconds. This a timeout for errors only. If there is an error, it will wait then try again. 5000 = 5 seconds.
const mintedArray = [];

if (!fs.existsSync(path.join(`${basePath}/build`, "/minted"))) {
  fs.mkdirSync(path.join(`${basePath}/build`, "minted"));
}

const fetchWithRetry = async (meta) =>
  new Promise((resolve, reject) => {
    let numberOfRetry = 10;
    let attempts = 1;

    const fetch_retry = (_meta, _n) => {
      const mintInfo = {
        chain: CHAIN,
        contract_address: CONTRACT_ADDRESS,
        metadata_uri: _meta.metadata_uri,
        mint_to_address: MINT_TO_ADDRESS,
        token_id: _meta.name.split("#")[1],
      };

      let options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: AUTH,
        },
        body: JSON.stringify(mintInfo),
      };

      return fetch("https://api.nftport.xyz/v0/mints/customizable", options)
        .then((res) => {
          const status = res.status;

          if (status === 200) {
            return resolve(res.json());
          } else if (_n === 1) {
            throw reject("Too many attempts.. Error in getting http data");
          } else {
            console.log("Retry again: Got back " + status);
            console.log("With delay " + attempts * TIMEOUT);
            setTimeout(() => {
              attempts++;

              fetch_retry(_meta, _n - 1);
            }, attempts * TIMEOUT);
          }
        })
        .catch(function (error) {
          if (_n === 1) {
            reject(error);
          } else {
            setTimeout(() => {
              attempts++;
              fetch_retry(_meta, _n - 1);
            }, attempts * TIMEOUT);
          }
        });
    };
    return fetch_retry(meta, numberOfRetry);
  });

const writeMintData = (_edition, _data) => {
  fs.writeFileSync(
    `${basePath}/build/minted/${_edition}.json`,
    JSON.stringify(_data, null, 2)
  );
};

const main = async () => {
  const ipfsMetas = JSON.parse(
    fs.readFileSync(`${basePath}/build/json/_ipfsMetas.json`)
  );

  for (const meta of ipfsMetas) {
    try {
      let mintData = await fetchWithRetry(meta);
      mintedArray.push(mintData);
      console.log(`Minted: ${meta.name}`);
      const combinedData = {
        metaData: meta,
        mintData: mintData,
      };
      writeMintData(meta.name.split("#")[1], combinedData);
    } catch (err) {
      console.log(err);
    }
  }
};

main();
