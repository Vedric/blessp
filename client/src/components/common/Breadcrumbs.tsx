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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 text-neutral-300" />
            )}
            {isLast || !item.href ? (
              <span className="text-xs font-medium tracking-wider text-neutral-900 uppercase">
                {item.label}
              </span>
            ) : (
              <Link
                to={item.href}
                className="text-xs tracking-wider text-neutral-400 uppercase transition-colors hover:text-neutral-600"
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
