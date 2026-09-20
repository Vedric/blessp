import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-neutral-300" />
            )}
            {isLast || !item.href ? (
              <span className="min-w-0 text-xs font-medium tracking-wider text-neutral-900 uppercase [overflow-wrap:anywhere]">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-xs tracking-wider text-neutral-600 uppercase transition-colors duration-200 hover:text-neutral-900 focus-visible:outline-none focus-visible:text-neutral-600 focus-visible:underline"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
