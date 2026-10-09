// Build map #D1 — one icon per taxonomy icon name (data/taxonomy.json's
// `icon` field). A category's icon string is data-driven from the API, so
// this registry is the single place a new icon name gets wired to a real
// lucide component.
import {
  Trash2,
  Flame,
  Broom,
  Droplet,
  Waves,
  AlertTriangle,
  Road,
  Lamp,
  Zap,
  Bug,
  TrafficCone,
  Trees,
  Building,
  HelpCircle,
  Car,
  type LucideIcon,
} from "lucide-react";

const REGISTRY: Record<string, LucideIcon> = {
  trash: Trash2,
  flame: Flame,
  broom: Broom,
  droplet: Droplet,
  waves: Waves,
  "alert-triangle": AlertTriangle,
  road: Road,
  lamp: Lamp,
  zap: Zap,
  bug: Bug,
  "traffic-cone": TrafficCone,
  trees: Trees,
  building: Building,
  "help-circle": HelpCircle,
  car: Car,
};

export const ALL_ICON_NAMES = Object.keys(REGISTRY);

export function CategoryIcon({
  name,
  size = 24,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const Icon = REGISTRY[name] ?? HelpCircle;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
