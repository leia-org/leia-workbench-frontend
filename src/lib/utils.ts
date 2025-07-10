import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utilidades para scroll en dispositivos móviles
export const scrollUtils = {
  // Scroll suave a un elemento específico
  scrollToElement: (elementId: string, options: ScrollIntoViewOptions = {}) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        ...options
      });
    }
  },

  // Scroll al final de un contenedor
  scrollToBottom: (containerRef: React.RefObject<HTMLElement | null>, smooth = true) => {
    if (containerRef.current) {
      const scrollOptions: ScrollToOptions = {
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      };
      containerRef.current.scrollTo(scrollOptions);
    }
  },

  // Verificar si un elemento está visible en el viewport
  isElementVisible: (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },

  // Obtener la posición de scroll actual
  getScrollPosition: (containerRef: React.RefObject<HTMLElement>): number => {
    return containerRef.current?.scrollTop || 0;
  },

  // Verificar si estamos cerca del final del scroll
  isNearBottom: (containerRef: React.RefObject<HTMLElement>, threshold = 100): boolean => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - threshold;
  }
};

// Utilidades para dispositivos móviles
export const mobileUtils = {
  // Verificar si es un dispositivo móvil
  isMobile: (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // Verificar si es iOS
  isIOS: (): boolean => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  },

  // Verificar si es Android
  isAndroid: (): boolean => {
    return /Android/.test(navigator.userAgent);
  },

  // Obtener la altura del viewport móvil
  getViewportHeight: (): number => {
    return window.innerHeight;
  },

  // Obtener la altura del viewport móvil considerando la barra de navegación
  getMobileViewportHeight: (): number => {
    return window.visualViewport?.height || window.innerHeight;
  }
};

// Utilidades para manejo de eventos táctiles
export const touchUtils = {
  // Prevenir zoom en inputs
  preventZoom: (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },

  // Mejorar la experiencia de scroll en iOS
  enableSmoothScroll: () => {
    (document.documentElement.style as any).webkitOverflowScrolling = 'touch';
  }
}; 