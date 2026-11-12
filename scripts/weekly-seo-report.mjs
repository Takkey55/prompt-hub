#!/usr/bin/env node
/**
 * scripts/weekly-seo-report.mjs
 * 
 * Google Search Console & GA4の過去7日間の最重要KPI（検索流入、表示、急上昇ワード、note遷移数）
 * を集計し、外部Webhook（Discord / Slack）へ軽量サマリー通知を送るスクリプト。
 * 
 * 認証情報（サービスアカウントJSON等）が未設定の場合は、開発・検証用のモック集計値で
 * 自動フォールバックし、いつでも安全に実行・テストできる設計になっています。
 */

// Format date helper: YYYY-MM-DD
function formatDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = new Date();
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(today.getDate() - 7);

const startDateStr = formatDate(sevenDaysAgo);
const endDateStr = formatDate(today);

// Environment variables
const WEBHOOK_URL = process.env.REPORT_WEBHOOK_URL || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_USER_ID = process.env.LINE_USER_ID || '';
const SITE_URL = process.env.GSC_SITE_URL || 'https://takkey55.github.io/prompt-hub/';
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';

async function fetchGoogleSearchConsoleData() {
  if (!GOOGLE_CREDENTIALS_JSON) {
    console.log('ℹ️ GOOGLE_APPLICATION_CREDENTIALS_JSON 未設定のため、サンプル指標を使用します。');
    return {
      clicks: 42,
      impressions: 1280,
      topKeywords: ['Astro Tailwind プロンプト', 'Claude Code 自動化', 'LP コピーライティング'],
      isLive: false,
    };
  }

  try {
    // Dynamic import to keep dependencies optional if run without googleapis installed
    const { google } = await import('googleapis');
    const credentials = JSON.parse(GOOGLE_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const res = await searchconsole.searchanalytics.query({
      siteUrl: SITE_URL,
      requestBody: {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ['query'],
        rowLimit: 5,
      },
    });

    const rows = res.data.rows || [];
    let totalClicks = 0;
    let totalImpressions = 0;
    const topKeywords = [];

    rows.forEach((row, index) => {
      totalClicks += row.clicks || 0;
      totalImpressions += row.impressions || 0;
      if (index < 3 && row.keys && row.keys[0]) {
        topKeywords.push(row.keys[0]);
      }
    });

    return {
      clicks: totalClicks,
      impressions: totalImpressions,
      topKeywords: topKeywords.length ? topKeywords : ['データ収集中'],
      isLive: true,
    };
  } catch (err) {
    console.warn('⚠️ GSC APIエラー (フォールバックデータを使用):', err.message);
    return {
      clicks: 0,
      impressions: 0,
      topKeywords: ['API接続エラー/計測収集中'],
      isLive: false,
    };
  }
}

async function fetchGA4NoteClicks() {
  if (!GOOGLE_CREDENTIALS_JSON || !GA4_PROPERTY_ID) {
    console.log('ℹ️ GA4_PROPERTY_ID 未設定のため、サンプル指標を使用します。');
    return {
      noteClicks: 18,
      isLive: false,
    };
  }

  try {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
    const credentials = JSON.parse(GOOGLE_CREDENTIALS_JSON);
    const analyticsDataClient = new BetaAnalyticsDataClient({ credentials });

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${GA4_PROPERTY_ID}`,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'eventName' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            value: 'cta_note',
          },
        },
      },
    });

    const count = response.rows?.[0]?.metricValues?.[0]?.value || 0;
    return {
      noteClicks: parseInt(count, 10),
      isLive: true,
    };
  } catch (err) {
    console.warn('⚠️ GA4 APIエラー (フォールバックデータを使用):', err.message);
    return {
      noteClicks: 0,
      isLive: false,
    };
  }
}

async function sendNotification(summaryText) {
  console.log('\n--- 生成されたレポート内容 ---');
  console.log(summaryText);
  console.log('-------------------------------\n');

  let sent = false;

  // 1. LINE Messaging API による送信
  if (LINE_CHANNEL_ACCESS_TOKEN) {
    try {
      console.log('📱 LINE Messaging API 経由で通知を送信中...');
      // If user ID is specified, use push message; otherwise use broadcast
      const endpoint = LINE_USER_ID
        ? 'https://api.line.me/v2/bot/message/push'
        : 'https://api.line.me/v2/bot/message/broadcast';

      const bodyData = LINE_USER_ID
        ? {
            to: LINE_USER_ID,
            messages: [{ type: 'text', text: summaryText }],
          }
        : {
            messages: [{ type: 'text', text: summaryText }],
          };

      const lineRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (lineRes.ok) {
        console.log('✅ LINEへの通知を正常に送信しました！');
        sent = true;
      } else {
        const errorText = await lineRes.text();
        console.error(`❌ LINE送信エラー: HTTP ${lineRes.status}`, errorText);
      }
    } catch (lineErr) {
      console.error('❌ LINE送信失敗:', lineErr.message);
    }
  }

  // 2. 汎用 Webhook (Discord / Slack / LINE Notify等) による送信
  if (WEBHOOK_URL) {
    try {
      let payload = {};
      if (WEBHOOK_URL.includes('slack.com')) {
        payload = { text: summaryText };
      } else {
        // Discord or general webhook
        payload = {
          content: summaryText,
          username: 'PromptHub Metrics Bot',
          avatar_url: 'https://takkey55.github.io/prompt-hub/favicon.svg',
        };
      }

      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log('✅ Webhook通知を正常に送信しました！');
        sent = true;
      } else {
        console.error(`❌ Webhook送信エラー: HTTP ${res.status} ${res.statusText}`);
      }
    } catch (err) {
      console.error('❌ Webhook送信失敗:', err.message);
    }
  }

  if (!sent && !LINE_CHANNEL_ACCESS_TOKEN && !WEBHOOK_URL) {
    console.log('ℹ️ LINE_CHANNEL_ACCESS_TOKEN または REPORT_WEBHOOK_URL が設定されていないため、外部送信をスキップしました。');
    console.log('💡 GitHub Secretsに LINE_CHANNEL_ACCESS_TOKEN を設定するとLINEに即時自動配信されます。');
  }
}

async function main() {
  console.log('📊 PromptHub 週次SEO & 成約レポート集計を開始します...');
  console.log(`対象期間: ${startDateStr} 〜 ${endDateStr}`);

  const gscData = await fetchGoogleSearchConsoleData();
  const ga4Data = await fetchGA4NoteClicks();

  const kw1 = gscData.topKeywords[0] ? `「${gscData.topKeywords[0]}」` : 'なし';
  const kw2 = gscData.topKeywords[1] ? `「${gscData.topKeywords[1]}」` : '';
  const kwText = [kw1, kw2].filter(Boolean).join(' ');

  const summary = [
    `📊 【PromptHub】先週の自動運用サマリー (${startDateStr}〜${endDateStr})`,
    `・Google検索流入: ${gscData.clicks} clicks (表示: ${gscData.impressions} 回)`,
    `・注目急上昇ワード: ${kwText}`,
    `・noteバナー成約遷移: ${ga4Data.noteClicks} 回`,
    `🔥 今週も完全自走中！`,
    !gscData.isLive ? `(※API未連携のためサンプル値を表示中。GitHub Secrets設定で本番値に切替可能)` : '',
  ].filter(Boolean).join('\n');

  await sendNotification(summary);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
