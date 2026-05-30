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
                    ? 'text-emerald-700 dark:text-emerald-500'
                    : 'text-red-700 dark:text-red-500',
                  'text-tremor-default font-medium',
                )}
              >
                {item.change}
              </dd>
            </div>
            <dd className="mt-1 flex items-baseline space-x-3">
              <span className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {item.stat}
              </span>
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