// 'use client';

import { Card, ProgressBar } from '@tremor/react';

const data = [
  {
    name: 'Requests',
    stat: '996',
    limit: '10,000',
    percentage: 9.96,
  },
  {
    name: 'Credits',
    stat: '$672',
    limit: '$1,000',
    percentage: 67.2,
  },
  {
    name: 'Storage',
    stat: '1.85',
    limit: '10GB',
    percentage: 18.5,
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
              {item.name}
            </dt>
            <dd className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {item.stat}
            </dd>
            <ProgressBar value={item.percentage} className="mt-6" />
            <dd className="mt-2 flex items-center justify-between text-tremor-default">
              <span className="text-tremor-brand dark:text-dark-tremor-brand">
                {item.percentage}&#37;
              </span>
              <span className="text-tremor-content dark:text-dark-tremor-content">
                {item.stat} of {item.limit}
              </span>
            </dd>
          </Card>
        ))}
      </dl>
    </>
  );
}