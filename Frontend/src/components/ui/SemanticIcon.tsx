import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Calculator,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock,
  Eye,
  FileCheck,
  FileText,
  FileWarning,
  FileX,
  HelpCircle,
  Info,
  Lock,
  Minus,
  PieChart,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import type { SemanticIconName } from '../../lib/semantics';

export interface SemanticIconProps {
  name: SemanticIconName;
  size?: number;
  className?: string;
}

const ICON_MAP: Record<SemanticIconName, React.FC<{ size?: number; className?: string; 'aria-hidden'?: boolean }>> = {
  CircleDot,
  Clock,
  PieChart,
  Eye,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Ban,
  ArrowUpRight,
  CheckSquare,
  FileCheck,
  AlertTriangle,
  XCircle,
  Info,
  Calculator,
  Sparkles,
  FileText,
  Lock,
  FileWarning,
  FileX,
  Minus,
};

export const SemanticIcon: React.FC<SemanticIconProps> = ({
  name,
  size = 14,
  className = '',
}) => {
  const Icon = ICON_MAP[name] || Info;
  return <Icon size={size} className={className} aria-hidden={true} />;
};
