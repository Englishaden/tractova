// 'use client';

import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Monthly active users',
    stat: '996',
    change: '+1.3%',
    color: 'bg-blue-500',
  },
  {
    name: 'Monthly sessions',
    stat: '1,672',
    change: '+9.1%',
    color: 'bg-violet-500',
  },
  {
    name: 'Monthly user growth',
    stat: '5.1%',
    change: '-4.8%',
    color: 'bg-fuchsia-500',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <div className="flex space-x-3">
              <div className={classNames(item.color, 'w-1 shrink-0 rounded')} />
              <dt className="flex w-full items-center justify-between space-x-3 truncate text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                <span className="truncate">{item.name}</span>
                <span className="font-medium text-tremor-content-emphasis dark:text-dark-tremor-content-emphasis">
                  {item.change}
                </span>
              </dt>
            </div>
            <div className="mt-2 pl-4">
              <dd className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {item.stat}
              </dd>
            </div>
          </Card>
        ))}
      </dl>
    </>
  );
}