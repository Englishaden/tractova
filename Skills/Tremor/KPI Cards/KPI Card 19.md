// 'use client';

import { useState } from 'react';
import { AreaChart, Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const numberFormatter = (number) => {
  return Intl.NumberFormat('us').format(number).toString();
};

const currencyFormatter = (number) => {
  return '$' + Intl.NumberFormat('us').format(number).toString();
};

function formatChange(
  payload,
  percentageChange,
  absoluteChange,
  valueFormatter,
) {
  if (!payload || isNaN(percentageChange)) {
    return '--';
  }

  const formattedPercentage = `${
    percentageChange > 0 ? '+' : ''
  }${percentageChange.toFixed(1)}%`;
  const formattedAbsolute = `${absoluteChange >= 0 ? '+' : '-'}${valueFormatter(
    Math.abs(absoluteChange),
  )}`;

  return `${formattedPercentage} (${formattedAbsolute})`;
}

const customTooltipHandler = (props, setselectedChartData) => {
  if (props.active) {
    setselectedChartData((prev) => {
      if (prev?.label === props?.label) return prev;
      return props;
    });
  } else {
    setselectedChartData(null);
  }
  return null;
};

const data = [
  {
    date: 'Jan 23',
    users: 234,
    sessions: 1432,
    revenue: 2340,
  },
  {
    date: 'Feb 23',
    users: 431,
    sessions: 1032,
    revenue: 3110,
  },
  {
    date: 'Mar 23',
    users: 543,
    sessions: 1089,
    revenue: 4643,
  },
  {
    date: 'Apr 23',
    users: 489,
    sessions: 988,
    revenue: 4650,
  },
  {
    date: 'May 23',
    users: 391,
    sessions: 642,
    revenue: 3980,
  },
  {
    date: 'Jun 23',
    users: 582,
    sessions: 786,
    revenue: 4702,
  },
  {
    date: 'Jul 23',
    users: 482,
    sessions: 673,
    revenue: 5990,
  },
  {
    date: 'Aug 23',
    users: 389,
    sessions: 761,
    revenue: 5700,
  },
  {
    date: 'Sep 23',
    users: 521,
    sessions: 793,
    revenue: 4250,
  },
  {
    date: 'Oct 23',
    users: 434,
    sessions: 543,
    revenue: 4182,
  },
  {
    date: 'Nov 23',
    users: 332,
    sessions: 678,
    revenue: 3812,
  },
  {
    date: 'Dec 23',
    users: 275,
    sessions: 873,
    revenue: 4900,
  },
];

const categories = [
  {
    name: 'Monthly users',
    chartCategory: 'users',
    valueFormatter: numberFormatter,
  },
  {
    name: 'Monthly sessions',
    chartCategory: 'sessions',
    valueFormatter: numberFormatter,
  },
  {
    name: 'Monthly revenue',
    chartCategory: 'revenue',
    valueFormatter: currencyFormatter,
  },
];

function CustomChart({ item }) {
  const [selectedChartData, setselectedChartData] = useState(null);
  const payload = selectedChartData?.payload[0];

  const value = payload?.payload[item.chartCategory];

  const customTooltipIndex = 'date';

  const previousIndex = data.findIndex(
    (e) => e[customTooltipIndex] === payload?.payload?.date,
  );
  const previousValues = previousIndex > 0 ? data[previousIndex - 1] : {};

  const prev = previousValues ? previousValues[item.chartCategory] : undefined;
  const percentageChange = ((value - prev) / prev) * 100 ?? undefined;
  const absoluteChange = value - prev ?? undefined;

  const formattedValue = payload
    ? item.valueFormatter(payload?.payload[item.chartCategory])
    : item.valueFormatter(data[0][item.chartCategory]);
  return (
    <Card>
      <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        {item.name}
      </dt>
      <dd className="text-tremor-title font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
        {formattedValue}
      </dd>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          On {payload ? `${payload?.payload?.date}` : `${data[0].date}`}
        </span>
        <span
          className={classNames(
            'rounded-tremor-small p-2 text-tremor-default font-medium',
            formatChange(
              payload,
              percentageChange,
              absoluteChange,
              item.valueFormatter,
            ) === '--'
              ? 'text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis'
              : payload && percentageChange > 0
                ? 'text-emerald-700 dark:text-emerald-500'
                : 'text-red-700 dark:text-red-500',
          )}
        >
          {formatChange(
            payload,
            percentageChange,
            absoluteChange,
            item.valueFormatter,
          )}
        </span>
      </dd>
      <AreaChart
        data={data}
        index="date"
        categories={[item.chartCategory]}
        showLegend={false}
        showYAxis={false}
        showGridLines={false}
        showGradient={false}
        startEndOnly={true}
        className="-mb-2 mt-3 h-24"
        customTooltip={(props) => {
          customTooltipHandler(props, setselectedChartData);
        }}
      />
    </Card>
  );
}

function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((item) => (
          <CustomChart item={item} key={item.name} />
        ))}
      </dl>
    </>
  );
}

export default Example;