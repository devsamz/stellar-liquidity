import React, { useState } from 'react';
import { TextField, Button, Box, Card, Typography } from '@mui/material';
import * as StellarSdk from '@stellar/stellar-sdk';
import { toast } from 'react-toastify';

const server = new StellarSdk.SorobanRpc.Server('https://soroban-testnet.stellar.org');

function LiquidityPoolForm() {
    const [amountA, setAmountA] = useState('');
    const [amountB, setAmountB] = useState('');
    const [assetName, setAssetName] = useState('');
    const [maxSwap, setMaxSwap] = useState('');
    const [swapAmount, setSwapAmount] = useState('')
    const [keypair, setKeypair] = useState('');
    const [keypairAddress, setKeypairAddress] = useState('');
    const [customAssetStored, setCustomAssetStored] = useState({});
    const [lpAssetStored, setLpAssetStored] = useState({});
    const [liquidityPoolIdStored, setLiquidityPoolIdStored] = useState('');
    const [isFunding, setIsFunding] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [createPoolResponse, setCreatePoolResponse] = useState('');
    const [swapResponse, setSwapResponse] = useState('');
    const [withdrawResponse, setWithdrawResponse] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    const generateKeypair = () => {
        // create random keypair
        const defiKeypair = StellarSdk.Keypair.random();
        setKeypair(defiKeypair);
        setKeypairAddress(defiKeypair.publicKey());
        console.log("Keypair generated:", defiKeypair.publicKey());
        console.log(keypair)
    }

    const fundAccount = async (address) => {
        setIsFunding(true);
        const friendbotUrl = `https://friendbot.stellar.org?addr=${address}`;
        try {
            let response = await fetch(friendbotUrl);
            if (response.ok) {
                toast(`Account successfully funded.`);
                console.log(response);
                return true;
            } else {
                console.log(`Something went wrong funding account`);
                return false;
            }
        } catch (error) {
            console.error(`Error funding account ${address}:`, error);
            toast(`Something went wrong funding account. Check console for details.`);
            return false;
        } finally {
            setIsFunding(false);
        }
    }

    const addLiquidity = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        try {
            const defiAccount =
                await server.getAccount(keypairAddress);
            // create custom asset from input
            const customAsset = new StellarSdk.Asset(assetName,
                keypairAddress);
            setCustomAssetStored(customAsset);
            // created a liquidity pool asset with the native xlm and my custom asset
            const lpAsset = new StellarSdk.LiquidityPoolAsset(
                StellarSdk.Asset.native(),
                customAsset,
                StellarSdk.LiquidityPoolFeeV18
            );
            setLpAssetStored(lpAsset);
            const liquidityPoolId = StellarSdk.getLiquidityPoolId(
                'constant_product',
                lpAsset
            ).toString('hex');
            setLiquidityPoolIdStored(liquidityPoolId);
            console.log("lpasset: ", lpAsset);
            console.log(lpAsset.getLiquidityPoolParameters());
            const addTransaction = new
                StellarSdk.TransactionBuilder(defiAccount, {
                    fee: StellarSdk.BASE_FEE,
                    networkPassphrase: StellarSdk.Networks.TESTNET,
                })
                .addOperation(
                    StellarSdk.Operation.changeTrust({
                        asset: lpAsset,
                    })
                )
                .addOperation(
                    StellarSdk.Operation.liquidityPoolDeposit({
                        liquidityPoolId: liquidityPoolId,
                        maxAmountA: amountA,
                        maxAmountB: amountB,
                        minPrice: { n: 1, d: 1 },
                        maxPrice: { n: 1, d: 1 },
                    })
                )
                .setTimeout(30)
                .build();
            addTransaction.sign(keypair);
            const result = await server.sendTransaction(addTransaction);
            setCreatePoolResponse(`Liquidity Pool Created. Transaction URL: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
        } catch (error) {
            console.error('Error:', error);
            toast('Error adding liquidity. Check console for details.');
        } finally {
            setAmountA('');
            setAmountB('');
            setAssetName('');
            setIsAdding(false);
        }
    };

    const swap = async (e) => {
        e.preventDefault();
        setIsSwapping(true);
        try {
            const traderKeypair = StellarSdk.Keypair.random();
            console.log("Trader Public Key:", traderKeypair.publicKey());
            await fundAccount(traderKeypair.publicKey());
            const traderAccount = await server.getAccount(traderKeypair.publicKey());
            const pathPaymentTransaction = new StellarSdk.TransactionBuilder(traderAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET
            })
                .addOperation(StellarSdk.Operation.changeTrust({
                    asset: customAssetStored,
                    source: traderKeypair.publicKey()
                }))
                .addOperation(StellarSdk.Operation.pathPaymentStrictReceive({
                    sendAsset: StellarSdk.Asset.native(),
                    sendMax: '1000',
                    destination: traderKeypair.publicKey(),
                    destAsset: customAssetStored,
                    destAmount: '50',
                    source: traderKeypair.publicKey()
                }))
                .setTimeout(30)
                .build();
            pathPaymentTransaction.sign(traderKeypair);

            const result = await server.sendTransaction(pathPaymentTransaction);
            toast(`Swap successfully performed.`);
            setSwapResponse(`Swap Performed. Transaction URL: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
        } catch (error) {
            console.log(`Error performing swap: ${error}`);
            toast('Error performing swap. Check console for details.')
        } finally {
            setIsSwapping(false);
        }
    }
    const withdraw = async (e) => {
        e.preventDefault();
        setIsWithdrawing(true);
        try {
            const defiAccount =
                await server.getAccount(keypairAddress);
            const lpWithdrawTransaction = new StellarSdk.TransactionBuilder(defiAccount, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: StellarSdk.Networks.TESTNET
            })
                .addOperation(StellarSdk.Operation.liquidityPoolWithdraw({
                    liquidityPoolId: StellarSdk.getLiquidityPoolId(
                        'constant_product',
                        lpAssetStored
                    ).toString('hex'),
                    amount: withdrawAmount,
                    minAmountA: '0',
                    minAmountB: '0'
                }))
                .setTimeout(30)
                .build();
            lpWithdrawTransaction.sign(keypair);

            const result = await server.sendTransaction(lpWithdrawTransaction);
            toast(`Withdrawal Successful.}`);
            setWithdrawResponse(`Withdrawal Successful. Transaction URL: https://stellar.expert/explorer/testnet/tx/${result.hash}`);
        } catch (error) {
            console.log(`Error withdrawing from Liquidity Pool: ${error}`);
        } finally {
            setWithdrawAmount('');
            setIsWithdrawing(false);
        }
    }

    return (
        <Box sx={{
            display: 'flex', flexDirection: 'column', gap: 2
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 10 }}>
                <Button variant='outlined' onClick={generateKeypair}>Generate Keypair</Button>
                <Card sx={{ mt: 1, fontSize: 12, textAlign: 'center', padding: 1 }}>{keypairAddress}</Card>
            </div>

            {keypair && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 5 }}>
                <Button variant='outlined' onClick={() => fundAccount(keypairAddress)}>{isFunding ? 'Funding...' : 'Fund Account'}</Button>
            </div>}

            <form style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 5 }} onSubmit={addLiquidity}>
                <Typography variant="p" component="h3" gutterBottom>
                    Add Liquidity
                </Typography>
                <TextField
                    label="Asset Name"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    required
                />
                <TextField
                    label="AmountA"
                    type="number"
                    value={amountA}
                    onChange={(e) => setAmountA(e.target.value)}
                    required
                />
                <TextField
                    label="AmountB"
                    type="number"
                    value={amountB}
                    onChange={(e) => setAmountB(e.target.value)}
                    required
                />
                <Button type="submit" variant="contained">
                    {isAdding ? 'Adding...' : 'Add Liquidity'}
                </Button>
                <Card sx={{ mt: 1, fontSize: 14, textAlign: 'center', overflowX: 'scroll', padding: 1 }}>{createPoolResponse}</Card>
            </form>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 5 }} onSubmit={swap}>
                <Typography variant="p" component="h3" gutterBottom>
                    Swap Token
                </Typography>
                <TextField
                    label="Max amount"
                    value={maxSwap}
                    onChange={(e) => { setMaxSwap(e.target.value) }}
                    required
                />
                <TextField
                    label="Destination Amount"
                    type="number"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    required
                />
                <Button type="submit" variant="contained">
                    {isSwapping ? 'Swapping...' : 'Swap Assets'}
                </Button>
                <Card sx={{ mt: 1, fontSize: 14, textAlign: 'center', overflowX: 'scroll', padding: 1 }}>{swapResponse}</Card>
            </form>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 5 }} onSubmit={withdraw}>
                <Typography variant="p" component="h3" gutterBottom>
                    Withdraw from pool
                </Typography>
                <TextField
                    label="Liquidity Pool Id"
                    value={liquidityPoolIdStored}
                    required
                />
                <TextField
                    label="WithdrawAmount"
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                />
                <Button type="submit" variant="contained">
                    {isWithdrawing ? 'Withdrawing...' : 'Withdraw Liquidity'}
                </Button>
                <Card sx={{ mt: 1, fontSize: 14, textAlign: 'center', overflowX: 'scroll', padding: 1 }}>{withdrawResponse}</Card>
            </form>
        </Box>
    );
}

export default LiquidityPoolForm;