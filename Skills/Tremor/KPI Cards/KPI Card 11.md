// 'use client';

import {
  RiArrowRightSLine,
  RiCheckLine,
  RiErrorWarningFill,
  RiEyeFill,
} from '@remixicon/react';
import { Card } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    name: 'Europe',
    stat: '$10,023',
    goalsAchieved: 3,
    status: 'observe',
    href: '#',
  },
  {
    name: 'North America',
    stat: '$14,092',
    goalsAchieved: 5,
    status: 'within',
    href: '#',
  },
  {
    name: 'Asia',
    stat: '$113,232',
    goalsAchieved: 1,
    status: 'critical',
    href: '#',
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
            <dd className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {item.stat}
            </dd>
            <div className="group relative mt-6 flex items-center space-x-4 rounded-tremor-small bg-tremor-background-subtle/60 p-2 hover:bg-tremor-background-subtle dark:bg-dark-tremor-background-subtle/60 hover:dark:bg-dark-tremor-background-subtle">
              <div className="flex w-full items-center justify-between truncate">
                <div className="flex items-center space-x-3">
                  <span
                    className={classNames(
                      item.status === 'within'
                        ? 'bg-emerald-500 text-white'
                        : item.status === 'observe'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-red-500 text-white',
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded',
                    )}
                  >
                    {item.status === 'within' ? (
                      <RiCheckLine
                        className="size-4 shrink-0"
                        aria-hidden={true}
                      />
                    ) : item.status === 'observe' ? (
                      <RiEyeFill
                        className="size-4 shrink-0"
                        aria-hidden={true}
                      />
                    ) : (
                      <RiErrorWarningFill
                        className="size-4 shrink-0"
                        aria-hidden={true}
                      />
                    )}
                  </span>
                  <dd>
                    <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                      <a href={item.href} className="focus:outline-none">
                        {/* Extend link to entire card */}
                        <span className="absolute inset-0" aria-hidden={true} />
                        {item.goalsAchieved}/5 goals
                      </a>
                    </p>
                    <p
                      className={classNames(
                        item.status === 'within'
                          ? 'text-emerald-800 dark:text-emerald-500'
                          : item.status === 'observe'
                            ? 'text-yellow-800 dark:text-yellow-500'
                            : 'text-red-800 dark:text-red-500',
                        'text-tremor-default font-medium',
                      )}
                    >
                      {item.status}
                    </p>
                  </dd>
                </div>
                <RiArrowRightSLine
                  className="size-5 shrink-0 text-tremor-content-subtle group-hover:text-tremor-content dark:text-dark-tremor-content-subtle group-hover:dark:text-dark-tremor-content"
                  aria-hidden={true}
                />
              </div>
            </div>
          </Card>
        ))}
      </dl>
    </>
  );
}