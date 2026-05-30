// 'use client';

import { useState } from 'react';
import { AreaChart, Card } from '@tremor/react';

const numberFormatter = (number) => {
  return Intl.NumberFormat('us').format(number).toString();
};

const percentageFormatter = (number) => {
  return Intl.NumberFormat('us').format(number).toString() + '%';
};

const data = [
  {
    date: 'Jan 23',
    users: 234,
    sessions: 1432,
    churn: 5.2,
  },
  {
    date: 'Feb 23',
    users: 431,
    sessions: 1032,
    churn: 4.3,
  },
  {
    date: 'Mar 23',
    users: 543,
    sessions: 1089,
    churn: 5.1,
  },
  {
    date: 'Apr 23',
    users: 489,
    sessions: 988,
    churn: 5.4,
  },
  {
    date: 'May 23',
    users: 391,
    sessions: 642,
    churn: 5.5,
  },
  {
    date: 'Jun 23',
    users: 582,
    sessions: 786,
    churn: 4.8,
  },
  {
    date: 'Jul 23',
    users: 482,
    sessions: 673,
    churn: 4.5,
  },
  {
    date: 'Aug 23',
    users: 389,
    sessions: 761,
    churn: 0,
  },
  {
    date: 'Sep 23',
    users: 521,
    sessions: 793,
    churn: 0,
  },
  {
    date: 'Oct 23',
    users: 434,
    sessions: 543,
    churn: 0,
  },
  {
    date: 'Nov 23',
    users: 332,
    sessions: 678,
    churn: 0,
  },
  {
    date: 'Dec 23',
    users: 275,
    sessions: 873,
    churn: 0,
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
    name: 'Monthly churn (%)',
    chartCategory: 'churn',
    valueFormatter: percentageFormatter,
  },
];

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

function CustomChart({ item }) {
  const [selectedChartData, setselectedChartData] = useState(null);
  const payload = selectedChartData?.payload[0];
  const formattedValue = payload
    ? item.valueFormatter(payload?.payload[item.chartCategory])
    : item.valueFormatter(data[0][item.chartCategory]);
  return (
    <Card>
      <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
        {item.name}
      </dt>
      <dd className="mt-1 flex items-baseline justify-between">
        <span className="text-tremor-title font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          {formattedValue}
        </span>
        <span className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          {payload ? `${payload?.payload?.date}` : `${data[0].date}`}
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