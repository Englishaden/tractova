// 'use client';

import { useState } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { BarList, Card, Dialog, DialogPanel, TextInput } from '@tremor/react';

const pages = [
  {
    name: '/home',
    value: 2019,
  },
  {
    name: '/blocks',
    value: 1053,
  },
  {
    name: '/components',
    value: 997,
  },
  {
    name: '/docs/getting-started/installation',
    value: 982,
  },
  {
    name: '/docs/components/button',
    value: 782,
  },
  {
    name: '/docs/components/table',
    value: 752,
  },
  {
    name: '/docs/components/area-chart',
    value: 741,
  },
  {
    name: '/docs/components/badge',
    value: 750,
  },
  {
    name: '/docs/components/bar-chart',
    value: 750,
  },
  {
    name: '/docs/components/tabs',
    value: 720,
  },
  {
    name: '/docs/components/tracker',
    value: 723,
  },
  {
    name: '/docs/components/icons',
    value: 678,
  },
  {
    name: '/docs/components/list',
    value: 645,
  },
  {
    name: '/journal',
    value: 701,
  },
  {
    name: '/spotlight',
    value: 650,
  },
  {
    name: '/resources',
    value: 601,
  },
  {
    name: '/imprint',
    value: 345,
  },
  {
    name: '/about',
    value: 302,
  },
];

const valueFormatter = (number) =>
  `${Intl.NumberFormat('us').format(number).toString()}`;

export default function Example() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const filteredItems = pages.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  return (
    <>
      <Card className="relative sm:mx-auto sm:max-w-lg">
        <p className="text-tremor-default text-tremor-content dark:text-dark-tremor-content">
          Website visitors
        </p>
        <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
          113,061
        </p>
        <div className="mt-6 flex items-center justify-between">
          <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
            Top 5 pages
          </p>
          <p className="text-tremor-label font-medium uppercase text-tremor-content dark:text-dark-tremor-content">
            Visitors
          </p>
        </div>
        <BarList
          data={pages.slice(0, 5)}
          valueFormatter={valueFormatter}
          className="mt-4"
        />
        <div className="absolute inset-x-0 bottom-0 flex justify-center rounded-b-tremor-default bg-gradient-to-t from-tremor-background to-transparent py-7 dark:from-dark-tremor-background">
          <button
            className="flex items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background px-2.5 py-2 text-tremor-default font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
            onClick={() => setIsOpen(true)}
          >
            Show more
          </button>
        </div>
        <Dialog
          open={isOpen}
          onClose={() => setIsOpen(false)}
          static={true}
          className="z-[100]"
        >
          <DialogPanel className="overflow-hidden p-0">
            <div className="px-6 pb-4 pt-6">
              <TextInput
                icon={RiSearchLine}
                placeholder="Search page..."
                className="rounded-tremor-small"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <div className="flex items-center justify-between pt-4">
                <p className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  Pages
                </p>
                <p className="text-tremor-label font-medium uppercase text-tremor-content dark:text-dark-tremor-content">
                  Visitors
                </p>
              </div>
            </div>
            <div className="h-96 overflow-y-scroll px-6">
              {filteredItems.length > 0 ? (
                <BarList data={filteredItems} valueFormatter={valueFormatter} />
              ) : (
                <p className="flex h-full items-center justify-center text-tremor-default text-tremor-content-strong dark:text-dark-tremor-content-strong">
                  No results.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-tremor-border bg-tremor-background-muted p-6 dark:border-dark-tremor-border dark:bg-dark-tremor-background">
              <button
                className="flex w-full items-center justify-center rounded-tremor-small border border-tremor-border bg-tremor-background py-2 text-tremor-default font-medium text-tremor-content-strong shadow-tremor-input hover:bg-tremor-background-muted dark:border-dark-tremor-border dark:bg-dark-tremor-background dark:text-dark-tremor-content-strong dark:shadow-dark-tremor-input hover:dark:bg-dark-tremor-background-muted"
                onClick={() => setIsOpen(false)}
              >
                Go back
              </button>
            </div>
          </DialogPanel>
        </Dialog>
      </Card>
    </>
  );
}