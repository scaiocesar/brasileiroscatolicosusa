declare namespace React {
	interface FormHTMLAttributes<T> {
		toolname?: string;
		tooldescription?: string;
		tooltitle?: string;
		toolautosubmit?: boolean;
	}

	interface HTMLAttributes<T> {
		toolparamdescription?: string;
	}
}
