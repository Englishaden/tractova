// 'use client';

import { RiArrowDownSFill, RiArrowUpSFill } from '@remixicon/react';
import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Monthly active users',
    stat: '340',
    previousStat: '400',
    change: '15%',
    changeType: 'negative',
  },
  {
    name: 'Monthly sessions',
    stat: '672',
    previousStat: '350',
    change: '91.4%',
    changeType: 'positive',
  },
  {
    name: 'Monthly page views',
    stat: '3,290',
    previousStat: '3,012',
    change: '9.2%',
    changeType: 'positive',
  },
];

export default function Example() {
  return (
    <>
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <Card key={item.name}>
            <dt className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
              {item.name}
            </dt>
            <dd className="mt-1 flex items-baseline space-x-2.5">
              <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
                {item.stat}
              </p>
              <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                from {item.previousStat}
              </p>
            </dd>
            <dd className="mt-4 flex items-center space-x-2">
              <p className="flex items-center space-x-0.5">
                {item.changeType === 'positive' ? (
                  <RiArrowUpSFill
                    className="size-5 shrink-0 text-emerald-700 dark:text-emerald-500"
                    aria-hidden={true}
                  />
                ) : (
                  <RiArrowDownSFill
                    className="size-5 shrink-0 text-red-700 dark:text-red-500"
                    aria-hidden={true}
                  />
                )}
                <span
                  className={classNames(
                    item.changeType === 'positive'
                      ? 'text-emerald-700 dark:text-emerald-500'
                      : 'text-red-700 dark:text-red-500',
                    'text-tremor-default font-medium',
                  )}
                >
                  {item.change}
                </span>
              </p>
              <p className="text-tremor-default text-tremor-content">
                from previous month
              </p>
            </dd>
          </Card>
        ))}
      </dl>
    </>
  );
}