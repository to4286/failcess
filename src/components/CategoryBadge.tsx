import { Category } from '@/types';
import { cn } from '@/lib/utils';

interface CategoryBadgeProps {
  category: Category;
  className?: string;
}

const categoryStyles: Record<Category, string> = {
  Finance: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Marketing: 'bg-blue-50 text-blue-700 border-blue-200',
  HR: 'bg-purple-50 text-purple-700 border-purple-200',
  MVP: 'bg-amber-50 text-amber-700 border-amber-200',
  Other: 'bg-slate-50 text-slate-600 border-slate-200',
};

const CategoryBadge = ({ category, className }: CategoryBadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        categoryStyles[category],
        className
      )}
    >
      {category}
    </span>
  );
};

export default CategoryBadge;
