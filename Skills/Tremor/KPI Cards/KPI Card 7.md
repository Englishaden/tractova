// 'use client';

import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Monthly active users',
    stat: '340',
    previousStat: '400',
    change: '-15%',
    changeType: 'negative',
  },
  {
    name: 'Monthly sessions',
    stat: '672',
    previousStat: '350',
    change: '+91.4%',
    changeType: 'positive',
  },
  {
    name: 'Monthly page views',
    stat: '3,290',
    previousStat: '3,012',
    change: '+9.2%',
    changeType: 'positive',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <div className="flex items-center justify-between space-x-4">
              <dt className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
                {item.name}
              </dt>
              <dd
                className={classNames(
                  item.changeType === 'positive'
                    ? 'bg-emerald-100 text-emerald-800 ring-emerald-600/10 dark:bg-emerald-400/10 dark:text-emerald-500 dark:ring-emerald-400/20'
                    : 'bg-red-100 text-red-800 ring-red-600/10 dark:bg-red-400/10 dark:text-red-500 dark:ring-red-400/20',
                  'inline-flex items-center rounded-tremor-small px-2 py-0.5 text-tremor-label font-medium ring-1 ring-inset',
                )}
              >
                {item.change}
              </dd>
            </div>
            <dd className="flex items-baseline space-x-3">
              <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {item.stat}
              </p>
              <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                from {item.previousStat}
              </p>
            </dd>
          </Card>
        ))}
      </dl>
    </>
  );
}