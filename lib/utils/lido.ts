import { ethers } from "ethers";
import { LidoStakeABIstring, LidoWithdrawABIstring } from "../resources/abis";

// Lido Staking ABI (submit 함수만 포함)
const LIDO_STAKING_ABI = LidoStakeABIstring;
const LIDO_WITHDRAWAL_ABI = LidoWithdrawABIstring;

/**
 * Lido Staking을 위한 callData 생성 함수
 * @param referral 추천인 주소 (없으면 AddressZero)
 * @returns Lido Staking 트랜잭션의 callData
 */
export function GetLidoStakingCallData(
  referral: string = ethers.ZeroAddress
): string {
  // Ethers.js 인터페이스 생성
  const iface = new ethers.Interface(LIDO_STAKING_ABI);

  // submit 함수 호출을 위한 callData 생성
  const callData = iface.encodeFunctionData("submit", [referral]);

  return callData;
}

/**
 * Lido Unstaking을 위한 callData 생성 함수
 * @param amount 출금할 stETH의 양 (ETH 단위, 문자열)
 * @param owner stETH 소유자 주소
 * @returns Lido Unstaking 트랜잭션의 callData
 */
export function GetLidoRequestWithdrawalCallData(
  amount: string,
  owner: string
): string {
  // 출금 요청량 (배열로 전달해야 함)
  const amounts = [ethers.parseEther(amount)];

  // Ethers.js 인터페이스 생성
  const iface = new ethers.Interface(LIDO_WITHDRAWAL_ABI);

  // requestWithdrawalsWithPermit 함수 호출을 위한 callData 생성
  const callData = iface.encodeFunctionData("requestWithdrawals", [
    amounts,
    owner,
  ]);

  return callData;
}

/**
 * claimWithdrawal 호출을 위한 calldata 생성
 * @param requestId 요청 ID (withdrawal request ID)
 * @param contractAddress Lido Withdrawal 컨트랙트 주소
 * @returns calldata string
 */
export function GetClaimWithdrawalCalldata(requestId: number): string {
  const iface = new ethers.Interface(LIDO_WITHDRAWAL_ABI);
  return iface.encodeFunctionData("claimWithdrawal", [requestId]);
}

// /**
//  * Lido APR 정보를 가져오는 함수
//  * @returns Lido APR - 최근 7일 APR 평균
//  */
export async function GetLidoApr(): Promise<string> {
  const lidoAprUrl: string =
    process.env.LIDO_APR_URL || "https://eth-api.lido.fi/";

  const response = await fetch(lidoAprUrl + "v1/protocol/steth/apr/sma");
  if (response.status != 200) {
    return "";
  }
  const data = await response.json();
  return data.data.smaApr;
}

/**
 * Lido Staking 수량을 가져오는 함수
 * @param userAddress 사용자의 주소
 * @param provider ethers.js provider
 * @returns 사용자의 Lido Staking 수량
 */
export async function GetUserLidoStakingAmount(
  userAddress: string,
  provider: ethers.JsonRpcProvider
): Promise<string> {
  const lidoStakingContractAddress =
    process.env.LIDO_STAKING_CONTRACT ||
    (() => {
      throw new Error("LIDO_STAKING_CONTRACT is not defined");
    })();

  // Lido Staking 컨트랙트 인스턴스 생성
  const lidoStaking = new ethers.Contract(
    lidoStakingContractAddress,
    LidoStakeABIstring,
    provider
  );

  // 사용자의 Lido Staking 수량을 가져오기 위한 함수 호출
  const stakingAmount = await lidoStaking.balanceOf(userAddress);
  return stakingAmount;
}

// TODO
// /**
//  * Lido unstaking 요청한 request 에 대해 withdraw 가능한 상태인지 확인하는 함수
//  * @param requestId 요청한 request의 ID
//  * @returns 요청한 request에 대해 withdraw 가능한 상태인지 여부
//  * @throws 요청한 request에 대해 withdraw 가능한 상태가 아닌 경우 에러 발생
//  * @throws 요청한 request에 대한 정보를 가져오는 데 실패한 경우 에러 발생
//  */
// export async function checkWithdrawalStatus(requestId: number): Promise<boolean> {
//   // Ethers.js 프로바이더 생성
//   const provider = new ethers.providers.JsonRpcProvider(
//     "https://mainnet.infura.io/v3/your-infura-project-id"
//   );

//   // Lido WithdrawalQueue 컨트랙트 인스턴스 생성
//   const lidoWithdrawalQueue = new ethers.Contract(
//     LIDO_WITHDRAWAL_QUEUE_CONTRACT,
//     LIDO_WITHDRAWAL_ABI,
//     provider
//   );

//   // 요청한 request의 정보를 가져오기 위한 함수 호출
//   const requestInfo = await lidoWithdrawalQueue.requests(requestId);

//   // 요청한 request에 대해 withdraw 가능한 상태인지 확인
//   if (requestInfo.withdrawable) {
//     return true;
//   } else {
//     throw new Error("The request is not withdrawable");
//   }
// }
