import "react";

declare module "react" {
	interface FormHTMLAttributes<T> {
		toolname?: string;
		tooltitle?: string;
		tooldescription?: string;
	}

	interface InputHTMLAttributes<T> {
		toolparamdescription?: string;
	}

	interface TextareaHTMLAttributes<T> {
		toolparamdescription?: string;
	}

	interface SelectHTMLAttributes<T> {
		toolparamdescription?: string;
	}
}
