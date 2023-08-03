import { Document } from 'mongoose';
interface IFutureOrder {
  displaying_id: number;
  user_id: number;
  status: number;
  side: string;
  type: string;
  symbol: string;
  price: number;
  quantity: number;
  xbt_quantity: number;
  remain_quantity: number;
  leverage: number;
  sl: number;
  tp: number;
  fee: number;
  fee_currency: number;
  swap: number;
  swap_currency: number;
  profit: number;
  margin: number;
  margin_currency: number;
  open_price: number;
  opened_at: Date;
  close_price: number;
  closed_at: Date;
  reason_close: string;
  reason_close_code: number;
  promote_program: number;
  fee_metadata: Record<string, any>;
  metadata: Record<string, any>;
}
export type FutureOrderDocument = IFutureOrder & Document;

interface IExchangeOrderHistory {
  displayingId: number;
  baseAsset: number;
  baseAssetId: number;
  sellerFee: Record<string, any>;
  buyerFee: Record<string, any>;
  price: number;
  flag: string;
  baseQty: number;
  quoteQty: number;
  quoteAsset: string;
  quoteAssetId: number;
  side: string;
  symbol: string;
  sellerId: number;
  sellOrderId: number;
  buyerId: number;
  buyOrderId: number;
  createdAt: Date;
  updatedAt: Date;
}
export type ExchangeOrderHistoryDocument = IExchangeOrderHistory & Document;

interface ISwapsOrder {
  displayingPrice: number;
  displayingPriceAsset: string;
  fromAsset: string;
  fromAssetId: number;
  fromQty: number;
  toAsset: string;
  toAssetId: number;
  toQty: number;
  displayingId: string;
  baseAsset: number;
  baseAssetId: number;
  createdAt: Date;
  executedQty: number;
  executedQuoteQty: number;
  feeMetadata: Record<string, any>;
  price: number;
  quantity: number;
  quoteAsset: string;
  quoteAssetId: number;
  quoteQty: number;
  side: string;
  status: string;
  symbol: string;
  type: string;
  updatedAt: Date;
  useQuoteQty: boolean;
  userId: number;
}
export type SwapsOrderDocument = ISwapsOrder & Document;
