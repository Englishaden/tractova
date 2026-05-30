// 'use client';

import { RiArrowRightUpLine } from '@remixicon/react';
import { Card, CategoryBar } from '@tremor/react';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

const data = [
  {
    channel: 'Direct sales',
    share: 34.4,
    revenue: '$100.5K',
    color: 'bg-blue-500',
    href: '#',
  },
  {
    channel: 'Retail stores',
    share: 30.6,
    revenue: '$89.5K',
    color: 'bg-orange-500',
    href: '#',
  },
  {
    channel: 'E-commerce',
    share: 20.9,
    revenue: '$61.2K',
    color: 'bg-sky-500',
    href: '#',
  },
  {
    channel: 'Wholesale',
    share: 14.1,
    revenue: '$41.2K',
    color: 'bg-purple-500',
    href: '#',
  },
];

export default function Example() {
  return (
    <>
      <div className="sm:mx-auto sm:max-w-2xl">
        <h3 className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Total sales
        </h3>
        <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          $292,400
        </p>
        <h4 className="mt-4 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Sales channel distribution
        </h4>
        <CategoryBar
          values={[34.4, 30.6, 20.9, 14.1]}
          colors={['blue', 'orange', 'sky', 'purple']}
          showLabels={false}
          className="mt-4"
        />
        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((item) => (
            <Card
              key={item.channel}
              className="group rounded-tremor-small px-3 py-2"
            >
              <div className="flex items-center space-x-2">
                <span
                  className={classNames(item.color, 'size-2.5 rounded-sm')}
                  aria-hidden={true}
                />
                <dt className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                  <a href={item.href} className="focus:outline-none">
                    {/* Extend link to entire card */}
                    <span className="absolute inset-0" aria-hidden={true} />
                    {item.channel}
                  </a>
                </dt>
              </div>
              <dd className="mt-1 text-tremor-default text-tremor-content-strong dark:text-dark-tremor-content-strong">
                <span className="font-semibold">{item.share}%</span> &#8729;{' '}
                {item.revenue}
              </dd>
              <span
                className="pointer-events-none absolute right-2 top-2 text-tremor-content-subtle group-hover:text-tremor-content dark:text-dark-tremor-content-subtle group-hover:dark:text-dark-tremor-content"
                aria-hidden={true}
              >
                <RiArrowRightUpLine className="size-4" aria-hidden={true} />
              </span>
            </Card>
          ))}
        </dl>
      </div>
    </>
  );
}