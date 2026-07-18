// Расчёт рекомендуемой цены и цены безубыточности для модуля
// "Ценообразование" (ProductForm.jsx + Pricing.jsx).
//
// Эквайринг считается в % от цены ПРОДАЖИ, а не от закупки — значит он
// зависит от того самого P, который мы вычисляем. Наивный расчёт (взять
// эквайринг от закупочной цены) занижает комиссию и завышает
// рекомендованную цену. Правильно — решить уравнение относительно P:
//
//   P = (закупка + упаковка + P × эквайринг% + доля_постоянных) × (1 + маржа)
//
// Обозначим C = закупка + упаковка + доля_постоянных (не зависит от P),
// a = эквайринг/100, m = маржа/100. Тогда:
//
//   цена_безубыточности = C / (1 - a)
//   рекомендуемая_цена  = C × (1 + m) / (1 - a × (1 + m))
//
// "Маржа" здесь — наценка на себестоимость (cost-plus), а не % от выручки.

export function calcPricing({ purchasePrice, settings }) {
  const fixedCostsMonthly = Number(settings?.fixedCostsMonthly) || 0;
  const plannedSalesMonthly = Number(settings?.plannedSalesMonthly) || 0;
  const packagingCostPerUnit = Number(settings?.packagingCostPerUnit) || 0;
  const acquiringPercent = Number(settings?.acquiringPercent) || 0;
  const defaultMarginPercent = Number(settings?.defaultMarginPercent) || 0;

  if (plannedSalesMonthly <= 0) {
    return { error: 'Заполните настройки ценообразования, чтобы видеть рекомендации' };
  }

  const a = acquiringPercent / 100;
  const m = defaultMarginPercent / 100;
  const denominatorBreakEven = 1 - a;
  const denominatorRecommended = 1 - a * (1 + m);

  if (denominatorBreakEven <= 0 || denominatorRecommended <= 0) {
    return { error: 'Комиссия эквайринга слишком высока относительно маржи — проверьте настройки ценообразования' };
  }

  const fixedShare = fixedCostsMonthly / plannedSalesMonthly;
  const cost = Number(purchasePrice) + packagingCostPerUnit + fixedShare;

  const breakEvenPrice = cost / denominatorBreakEven;
  const recommendedPrice = (cost * (1 + m)) / denominatorRecommended;
  const acquiringCostAtRecommended = recommendedPrice * a;
  const unitCost = Number(purchasePrice) + packagingCostPerUnit + acquiringCostAtRecommended;

  return { fixedShare, unitCost, breakEvenPrice, recommendedPrice };
}

// green — текущая цена ≥ рекомендуемой (хорошая маржа)
// yellow — между безубыточностью и рекомендуемой (в плюсе, но ниже желаемой маржи)
// red — ниже безубыточности (продаём в убыток)
export function pricingStatus(currentPrice, { breakEvenPrice, recommendedPrice }) {
  const price = Number(currentPrice) || 0;
  if (price >= recommendedPrice) return 'green';
  if (price >= breakEvenPrice) return 'yellow';
  return 'red';
}
