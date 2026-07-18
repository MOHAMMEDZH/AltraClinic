import {
  BarChart3,
  Bot,
  Calendar,
  CreditCard,
  FileBarChart,
  GitBranch,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Smile,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Users,
  UserRound,
  Stethoscope,
  Smile,
  Sparkles,
  Receipt,
  Package,
  FileBarChart,
  BarChart3,
  GitBranch,
  Bot,
  Settings,
};

export function resolveNavIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? LayoutDashboard;
}
