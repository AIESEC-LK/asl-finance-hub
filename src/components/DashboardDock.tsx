import { useEffect, useState } from "react";
import { fetchEntities, type Entity } from "@/lib/finance";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";

interface DockItem {
  id: string;
  entity: string;
  term: string;
  from: string;
  to: string;
}

interface DashboardDockProps {
  views: DockItem[];
  onReorder: (newViews: DockItem[]) => void;
  onRemove: (id: string) => void;
}

interface SortableDockItemProps {
  view: DockItem;
  isActive: boolean;
  entityName: string;
  dateRange: string;
  onClick: () => void;
  onRemove: () => void;
}

function SortableDockItem({
  view,
  isActive,
  entityName,
  dateRange,
  onClick,
  onRemove,
}: SortableDockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
        isActive
          ? "bg-white/20 text-white scale-105"
          : "hover:bg-[#0268c7] text-white/70 hover:text-white"
      }`}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-1 -right-1 z-10 p-0.5 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 cursor-pointer"
        title="Remove View"
      >
        <X className="h-2.5 w-2.5" />
      </button>

      {/* Grip Handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-white/50 hover:text-white p-0.5 shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="flex flex-col items-center select-none cursor-pointer" onClick={onClick}>
        <span className="text-xs font-bold text-white truncate max-w-[100px]">
          {entityName}
        </span>
        <span className="text-[10px] text-white/70">
          {dateRange}
        </span>
      </div>
    </div>
  );
}

export function DashboardDock({ views, onReorder, onRemove }: DashboardDockProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // enable dragging only after moving 5px (keeps normal clicks functional)
      },
    })
  );

  useEffect(() => {
    fetchEntities().then(setEntities);
  }, []);

  useEffect(() => {
    if (views.length <= 1) {
      setActiveId(null);
      return;
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      let maxRatio = 0;
      let activeCardId = activeId;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          activeCardId = entry.target.id.replace("card-", "");
        }
      });

      if (activeCardId && activeCardId !== activeId) {
        setActiveId(activeCardId);
      }
    };

    const observerOptions = {
      root: null,
      rootMargin: "0px -20% 0px -20%",
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    views.forEach((view) => {
      const el = document.getElementById(`card-${view.id}`);
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [views, activeId]);

  if (views.length <= 1) return null;

  const handleScrollToCard = (id: string) => {
    const el = document.getElementById(`card-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = views.findIndex((v) => v.id === active.id);
      const newIndex = views.findIndex((v) => v.id === over.id);
      onReorder(arrayMove(views, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 bg-[#037EF3] text-white shadow-2xl rounded-full px-4 py-2 h-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] max-w-[90vw] overflow-x-auto">
        <SortableContext
          items={views.map((v) => v.id)}
          strategy={horizontalListSortingStrategy}
        >
          {views.map((view) => {
            const isActive = activeId === view.id;
            const matchedEntity = entities.find((e) => e.id === view.entity);
            
            // Map local state to requested display keys
            const entityName = view.entity === "Select LC" ? "Unassigned LC" : (matchedEntity?.name || "Unknown");
            const dateRange = view.from && view.to
              ? `${formatDate(view.from)} - ${formatDate(view.to)}`
              : view.term || "No Date";

            return (
              <SortableDockItem
                key={view.id}
                view={view}
                isActive={isActive}
                entityName={entityName}
                dateRange={dateRange}
                onClick={() => handleScrollToCard(view.id)}
                onRemove={() => onRemove(view.id)}
              />
            );
          })}
        </SortableContext>
      </div>
    </DndContext>
  );
}
