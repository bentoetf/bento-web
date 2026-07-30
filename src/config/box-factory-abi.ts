// Generated from bento-synth BoxFactory (v4, WETH unwrap + creatorShareBps init).
export const boxFactoryAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "owner_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "ponsLauncher_",
        "type": "address",
        "internalType": "contract IPonsLaunchFactory"
      },
      {
        "name": "ethUsdOracle_",
        "type": "address",
        "internalType": "contract IOracleAdapter"
      },
      {
        "name": "boxDeployer_",
        "type": "address",
        "internalType": "contract BoxDeployer"
      },
      {
        "name": "ethMaxStaleness_",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "mintFeeBps_",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "redeemFeeBps_",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "protocolWallet_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "usdg_",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "weth_",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "receive",
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DRIP_COIN_POOL_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_CREATOR_SHARE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_FEE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "boxCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "boxDeployer",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract BoxDeployer"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "collectFees",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "collectPonsFees",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "amount0",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount1",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "createBox",
    "inputs": [
      {
        "name": "name_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "symbol_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "boxType",
        "type": "uint8",
        "internalType": "enum BoxFactory.BoxType"
      },
      {
        "name": "components_",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.Component[]",
        "components": [
          {
            "name": "adapter",
            "type": "address",
            "internalType": "contract IOracleAdapter"
          },
          {
            "name": "weightBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxStaleness",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "backedComponents_",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.BackedComponent[]",
        "components": [
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "feed",
            "type": "address",
            "internalType": "contract IOracleAdapter"
          },
          {
            "name": "weightBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxStaleness",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "coin",
        "type": "tuple",
        "internalType": "struct BoxFactory.CoinParams",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "logo",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "socials",
            "type": "tuple",
            "internalType": "struct IPonsLaunchFactory.Socials",
            "components": [
              {
                "name": "twitter",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "telegram",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "discord",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "website",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "farcaster",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "launchConfigId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dexId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "salt",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "box",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "creatorCoin",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "createBoxWithDrip",
    "inputs": [
      {
        "name": "name_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "symbol_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "components_",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.Component[]",
        "components": [
          {
            "name": "adapter",
            "type": "address",
            "internalType": "contract IOracleAdapter"
          },
          {
            "name": "weightBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxStaleness",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "coin",
        "type": "tuple",
        "internalType": "struct BoxFactory.CoinParams",
        "components": [
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "symbol",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "logo",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "description",
            "type": "string",
            "internalType": "string"
          },
          {
            "name": "socials",
            "type": "tuple",
            "internalType": "struct IPonsLaunchFactory.Socials",
            "components": [
              {
                "name": "twitter",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "telegram",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "discord",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "website",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "farcaster",
                "type": "string",
                "internalType": "string"
              }
            ]
          },
          {
            "name": "launchConfigId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "dexId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "salt",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "box",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "creatorCoin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "router",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "createBoxWithoutCoin",
    "inputs": [
      {
        "name": "name_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "symbol_",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "boxType",
        "type": "uint8",
        "internalType": "enum BoxFactory.BoxType"
      },
      {
        "name": "components_",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.Component[]",
        "components": [
          {
            "name": "adapter",
            "type": "address",
            "internalType": "contract IOracleAdapter"
          },
          {
            "name": "weightBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxStaleness",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "backedComponents_",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.BackedComponent[]",
        "components": [
          {
            "name": "token",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "feed",
            "type": "address",
            "internalType": "contract IOracleAdapter"
          },
          {
            "name": "weightBps",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "maxStaleness",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "box",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "creationFee",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creationsPaused",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "creatorShareBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dripKeeper",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dripRouter",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ethMaxStaleness",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ethUsdOracle",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IOracleAdapter"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBox",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct BoxFactory.BoxRecord",
        "components": [
          {
            "name": "box",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creatorCoin",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "feeSplitter",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "boxType",
            "type": "uint8",
            "internalType": "enum BoxFactory.BoxType"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBoxes",
    "inputs": [
      {
        "name": "offset",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "limit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "page",
        "type": "tuple[]",
        "internalType": "struct BoxFactory.BoxRecord[]",
        "components": [
          {
            "name": "box",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creatorCoin",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "feeSplitter",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "creator",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "boxType",
            "type": "uint8",
            "internalType": "enum BoxFactory.BoxType"
          },
          {
            "name": "name",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mintFeeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ponsLauncher",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IPonsLaunchFactory"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "protocolWallet",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "redeemFeeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setCreationFee",
    "inputs": [
      {
        "name": "fee",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCreationsPaused",
    "inputs": [
      {
        "name": "p",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setCreatorShareBps",
    "inputs": [
      {
        "name": "bps",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setDripKeeper",
    "inputs": [
      {
        "name": "newKeeper",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "usdg",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "weth",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BoxCreated",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "box",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creator",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "creatorCoin",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "feeSplitter",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "name",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CreationFeeSet",
    "inputs": [
      {
        "name": "fee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CreationsPausedSet",
    "inputs": [
      {
        "name": "paused",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CreatorShareBpsSet",
    "inputs": [
      {
        "name": "bps",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DripKeeperUpdated",
    "inputs": [
      {
        "name": "previousKeeper",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newKeeper",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "DripRouterCreated",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "router",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeesCollected",
    "inputs": [
      {
        "name": "boxId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BadParams",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CapExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CreationsPaused",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientFee",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAuthorized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  }
] as const;
