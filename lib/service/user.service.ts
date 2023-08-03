import { get, keyBy } from 'lodash';
import * as bodybuilder from 'bodybuilder';
import { ElasticsearchService } from 'lib/interface/elasticsearch.interface';
import { Model } from 'mongoose';
import {
  ExchangeOrderHistoryDocument,
  FutureOrderDocument,
  SwapsOrderDocument,
} from '../interface/order/order_document.interface';

export class UserService {
  async getUserVol(
    userId: number,
    from: Date,
    to: Date,
    futuresOrderModel: Model<FutureOrderDocument>,
    spotsOrderHistoryModel: Model<ExchangeOrderHistoryDocument>,
    swapOrderModel: Model<SwapsOrderDocument>,
    esService: ElasticsearchService,
  ) {
    // Get data from es
    // Get field sum_order_value if want to get value already change to USDT
    // Get field _sum_order_value if want to get origin value'
    const esData = await esService
      .search({
        index: process.env.ES_COMMISSION_INDEX ?? 'commission-dev',
        track_total_hits: true,
        body: bodybuilder()
          .notQuery('match', 'commssion_type.keyword', 'REMUNERATION')
          .query('term', 'to_user_id', userId)
          .query('range', 'created_at', { gte: from, lte: to })

          .aggregation('terms', 'order_type', 'group_by_order_type', (q) => {
            return q.aggregation(
              'terms',
              'currency',
              'group_by_currency',
              (q) => {
                return q
                  .aggregation('sum', 'order_value', '_sum_order_value')
                  .aggregation(
                    'bucket_script',
                    {
                      buckets_path: {
                        sumValues: '_sum_order_value',
                        currencyKey: '_key',
                      },
                      script:
                        'if(params.currencyKey == 72) { params.sumValues / 24000 } else { params.sumValues}',
                      format: '###0',
                    },
                    'sum_order_value',
                  );
              },
            );
          })
          .size(0)
          .build(),
      })
      .then((v) =>
        keyBy(
          get(v, ['aggregations', 'group_by_order_type', 'buckets'], []),
          'key',
        ),
      );

    /// Sum Futures order volumn by order_type and currency of child
    const esFuturesVol = ['futures', 'nao_futures'].reduce(
      (sum, order_type) => {
        const buckets = get(
          esData,
          [order_type, 'group_by_currency', 'buckets'],
          [],
        );
        const keyed_buckets = keyBy(buckets, 'key');

        return (
          sum +
          get(keyed_buckets, [72, 'sum_order_value', 'value'], 0) +
          get(keyed_buckets, [22, 'sum_order_value', 'value'], 0)
        );
      },
      0,
    );

    /// Sum Spot order volumn by order_type and currency of child
    const esSpotVol = ['spot'].reduce((sum, order_type) => {
      const buckets = get(
        esData,
        [order_type, 'group_by_currency', 'buckets'],
        [],
      );
      const keyed_buckets = keyBy(buckets, 'key');

      return (
        sum +
        get(keyed_buckets, [72, 'sum_order_value', 'value'], 0) +
        get(keyed_buckets, [22, 'sum_order_value', 'value'], 0)
      );
    }, 0);

    /// Get data Futures in mongo of parent
    const [{ mongoFuturesVol = 0 } = {}] = await futuresOrderModel
      .aggregate()
      .match({
        user_id: +userId,
        status: 2,
        close_price: { $gt: 0 },
        closed_at: { $gte: from, $lt: to },
      })
      .group({
        _id: { currency: '$order_value_currency' },
        volume: { $sum: '$order_value' },
        close_volume: { $sum: '$close_order_value' },
      })
      .project({
        currency: '$_id.currency',
        volume_22: {
          $cond: [
            { $eq: ['$_id.currency', 72] },
            { $divide: [{ $add: ['$volume', '$close_volume'] }, 24000] },
            { $add: ['$volume', '$close_volume'] },
          ],
        },
      })
      .group({ _id: null, mongoFuturesVol: { $sum: '$volume_22' } })
      .read('secondary');

    /// Get data Spot in mongo of parent
    const [{ mongoSpotsVol = 0 } = {}] = await spotsOrderHistoryModel
      .aggregate()
      .match({
        $or: [{ sellerId: +userId }, { buyerId: +userId }],
        createdAt: { $gte: from, $lt: to },
      })
      .group({
        _id: { currency: '$quoteAssetId' },
        volume: { $sum: '$quoteQty' },
      })
      .project({
        currency: '$_id.currency',
        volume_22: {
          $cond: [
            { $eq: ['$_id.currency', 72] },
            { $divide: ['$volume', 24000] },
            '$volume',
          ],
        },
      })
      .group({ _id: null, mongoSpotsVol: { $sum: '$volume_22' } })
      .read('secondary');

    /// Get data Swap in mongo of parent
    const [{ mongoSwapsVol = 0 } = {}] = await swapOrderModel
      .aggregate()
      .match({
        userId: +userId,
        createdAt: { $gte: from, $lt: to },
      })
      .project({
        volume: {
          $switch: {
            branches: [
              {
                case: { $in: ['$fromAsset', ['VNDC', 'USDT']] },
                then: '$fromQty',
              },
            ],
            default: '$toQty',
          },
        },
        asset: {
          $switch: {
            branches: [
              {
                case: { $in: ['$fromAsset', ['VNDC', 'USDT']] },
                then: '$fromAsset',
              },
            ],
            default: '$toAsset',
          },
        },
      })
      .project({
        volume_22: {
          $cond: [
            { $eq: ['$asset', 'VNDC'] },
            { $divide: ['$volume', 24000] },
            '$volume',
          ],
        },
      })
      .group({
        _id: null,
        mongoSwapsVol: { $sum: '$volume_22' },
      })
      .read('secondary');

    return {
      futures: esFuturesVol + mongoFuturesVol,
      spot: esSpotVol + mongoSpotsVol + mongoSwapsVol,
    };
  }
}
